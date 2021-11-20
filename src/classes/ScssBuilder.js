/**
 * Requires
 */
const path = require( 'path' );
const fs = require( 'fs' );
const sass = require( 'sass' );
const packageImporter = require( 'node-sass-package-importer' );
const autoprefixer = require( 'autoprefixer' );
const postcss = require( 'postcss' );
const Exception = require( '@squirrel-forge/node-util' ).Exception;
const FsInterface = require( '@squirrel-forge/node-util' ).FsInterface;
const isPojo = require( '@squirrel-forge/node-util' ).isPojo;

/**
 * ScssBuilder exception
 * @class
 */
class ScssBuilderException extends Exception {}

/**
 * ScssBuilder class
 * @class
 * @type {ScssBuilder}
 */
class ScssBuilder {

    /**
     * Constructor
     * @constructor
     * @param {null|console} cfx - Console or alike object
     */
    constructor( cfx = null ) {

        /**
         * Console alike reporting object
         * @protected
         * @property
         * @type {console|null}
         */
        this._cfx = cfx;

        /**
         * File system interface
         * @public
         * @property
         * @type {FsInterface}
         */
        this.fs = new FsInterface();

        /**
         * Strict mode
         * @public
         * @property
         * @type {boolean}
         */
        this.strict = true;

        /**
         * Verbose mode
         * Outputs the full stack of nonfatal exceptions
         * @public
         * @property
         * @type {boolean}
         */
        this.verbose = true;

        /**
         * Output file extension
         * @public
         * @property
         * @type {string}
         */
        this.outputExt = '.css';

        /**
         * Output compressed file extension
         * @public
         * @property
         * @type {string}
         */
        this.outputCompressedExt = '.min.css';

        /**
         * Sass options
         * @public
         * @property
         * @type {Object}
         */
        this.options = {
            outputStyle : 'compressed',
            sourceMap : true,
            importer : [ packageImporter() ]
        };

        /**
         * Use postcss
         * @public
         * @property
         * @type {null|false|Object}
         */
        this.postprocess = { map : { inline : false } };

        /**
         * Post CSS processors
         * @public
         * @property
         * @type {Array}
         */
        this.processors = [ autoprefixer ];
    }

    /**
     * Parse exception for output
     * @protected
     * @param {string|Error|Exception} msg - Message or exception instance
     * @param {boolean} noTrace - Do not output trace since it is internal
     * @return {string} - Exception output
     */
    _exceptionAsOutput( msg, noTrace = false ) {

        // We check if its an exception, all other errors will be sent to output unmodified
        if ( msg instanceof Exception ) {
            if ( this.verbose && !noTrace ) {

                // In verbose we want to whole stack
                return msg.stack;
            } else {

                // In normal mode we just send the short string representation without the stack
                return msg + '';
            }
        }
        return msg;
    }

    /**
     * Error output
     *  Throw in strict mode or always true
     *  Notify in normal mode
     *  Show full trace in verbose mode
     * @public
     * @param {string|Error|Exception} msg - Message or exception instance
     * @param {boolean} always - Fatal error, always throw
     * @throws {Exception}
     * @return {void}
     */
    error( msg, always = false ) {

        // In strict mode we always throw
        if ( always || this.strict ) {
            throw msg;
        }

        // If we are not silent and we have a fitting error logger
        if ( this._cfx && typeof this._cfx.error === 'function' ) {
            this._cfx.error( this._exceptionAsOutput( msg ) );
        }
    }

    /**
     * Get sass options
     * @protected
     * @param {null|Object} options - Options object
     * @return {Object} - Sass options
     */
    _getSassOptions( options = null ) {
        if ( options === null ) {
            options = this.options;
        }
        if ( !isPojo( options ) ) {
            throw new ScssBuilderException( 'Invalid sass options object' );
        }
        return options;
    }

    /**
     * Render file
     * @public
     * @param {string} file - File path
     * @param {Object} source - Source object
     * @param {Object} target - Target object
     * @param {null|Object} options - Sass options
     * @return {Object} - File object
     */
    renderFile( file, source, target, options = null ) {
        options = this._getSassOptions( options );
        const data = this._getFileData( file, source, target, options );

        // Set input/output
        options.file = file;
        options.outFile = data.target.path;

        // Render and return
        const rendered = sass.renderSync( options );
        return { data, rendered };
    }

    /**
     * Resolve source
     * @protected
     * @param {string} source - Source path
     * @return {Promise<{root: string, files: string[], source, resolved: string}>} - Source object
     */
    async _resolveSource( source ) {

        // Resolve source
        const resolved = path.resolve( source );

        // Require valid source
        const source_exists = await this.fs.exists( resolved );
        if ( !source_exists ) {
            throw new ScssBuilderException( 'Source not found: ' + resolved );
        }

        // Convert to array for processing
        let files = [ resolved ], root = resolved;

        // Fetch files if source is a directory
        if ( fs.lstatSync( resolved ).isDirectory() ) {
            files = this.fs.fileList( resolved, { exclude : /\/_[^/]*\.scss$/, extensions : /\.scss/ } );

            // Require file results
            if ( !files.length ) {
                throw new ScssBuilderException( 'Source is empty: ' + resolved );
            }
        } else {
            root = path.dirname( resolved );
        }

        return { root, source, resolved, files };
    }

    /**
     * Resolve target
     * @protected
     * @param {string} target - Target source
     * @return {Promise<{created: null, exists: boolean, target, resolved: string}>} - Target object
     */
    async _resolveTarget( target ) {

        // Resolve target
        const resolved = path.resolve( target );

        // Attempt create
        let created = null, exists = await this.fs.exists( resolved );
        if ( !exists ) {
            created = await this.fs.dir( resolved );
            exists = true;
        }

        // Check for directory if not created
        if ( !created && !fs.lstatSync( resolved ).isDirectory() ) {
            throw new ScssBuilderException( 'Target must be a directory: ' + resolved );
        }
        return { target, resolved, exists, created };
    }

    /**
     * Get path data
     * @protected
     * @param {string} file - File path
     * @param {null|string} ext - File extension change
     * @return {{ext: string, name: string, dir: string}} - Path data
     */
    _getPathData( file, ext = null ) {
        const data = {
            dir : path.dirname( file ),
            name : path.basename( file, path.extname( file ) ),
            ext : ext || path.extname( file ),
        };
        data.path = ext ? path.join( data.dir, data.name + data.ext ) : file;
        return data;
    }

    /**
     * Get file data
     * @protected
     * @param {string} file - File path
     * @param {Object} source - Source object
     * @param {Object} target - Target object
     * @param {Object} options - Sass options
     * @return {Object} - File data
     */
    _getFileData( file, source, target, options ) {
        const target_path = path.join( target.resolved, this.fs.relative2root( file, source.root ) );
        let ext = this.outputExt;
        if ( options.outputStyle === 'compressed' ) {
            ext = this.outputCompressedExt;
        }
        return {
            source_root : source.root,
            target_root : target.resolved,
            source : this._getPathData( file ),
            target : this._getPathData( target_path, ext ),
        };
    }

    /**
     * Get postcss options
     * @protected
     * @param {null|Object} options - Options object
     * @return {null|false|Object} - PostCSS options
     */
    _getProcessOptions( options ) {
        if ( options === null ) {
            options = this.postprocess === true ? {} : this.postprocess;
        }
        if ( !isPojo( options ) ) {
            throw new ScssBuilderException( 'Invalid postcss options object' );
        }
        return options;
    }

    /**
     * Process file with postcss
     * @param {Object} file - File object
     * @param {Object} options - PostCSS options
     * @return {Promise<void>} - Returns no value, modifies the file object
     */
    async processFile( file, options = null ) {
        options = this._getProcessOptions( options );
        options.from = file.data.source.path;
        options.to = file.data.target.path;
        file.processed = await postcss( this.processors ).process( file.rendered.css, options );
    }

    /**
     * Run build
     * @param {string} source - Source path
     * @param {string} target - Target path
     * @param {null|function} callback - Before write callback
     * @return {Promise<{processed: number, sources: number, rendered: number, maps: number, written: number}>} - Stats
     */
    async run( source, target, callback = null ) {

        source = await this._resolveSource( source );
        target = await this._resolveTarget( target );

        const stats = {
            sources : source.files.length,
            rendered : 0,
            processed : 0,
            written : 0,
            maps : 0,
        };

        for ( let i = 0; i < source.files.length; i++ ) {
            let file = null;
            try {
                file = this.renderFile( source.files[ i ], source, target );
                if ( file ) {
                    stats.rendered++;
                }
            } catch ( e ) {
                this.error( new ScssBuilderException( 'Render failed for: ' + source.files[ i ], e ) );
            }

            if ( this.postprocess && file ) {
                try {
                    await this.processFile( file );
                    if ( file.processed ) {
                        stats.processed++;
                    }
                } catch ( e ) {
                    this.error( new ScssBuilderException( 'PostCSS failed for: ' + source.files[ i ], e ) );
                }
            }

            let write = true;
            if ( file && typeof callback === 'function' ) {
                write = await callback( file, stats, this );
            }

            if ( write && file ) {
                let css = file.rendered.css.toString(), map = null;
                if ( this.postprocess && file.processed ) {
                    css = file.processed.css.toString();
                    if ( file.processed.map ) {
                        map = file.processed.map.toString();
                    }
                } else if ( file.rendered.map ) {
                    map = file.rendered.map.toString();
                }
                const wrote_css = await this.fs.write( file.data.target.path, css );
                if ( !wrote_css ) {
                    this.error( new ScssBuilderException( 'Failed to write: ' + file.data.target.path ) );
                } else {
                    stats.written++;
                }
                if ( map ) {
                    const wrote_map = await this.fs.write( file.data.target.path + '.map', map );
                    if ( !wrote_map ) {
                        this.error( new ScssBuilderException( 'Failed to write: ' + file.data.target.path + '.map' ) );
                    } else {
                        stats.maps++;
                    }
                }
            }
        }

        return stats;
    }
}

// Export Exception as static property constructor
ScssBuilder.ScssBuilderException = ScssBuilderException;
module.exports = ScssBuilder;
