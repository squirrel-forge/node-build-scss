/**
 * Requires
 */
const path = require( 'path' );
const sass = require( 'sass' );
const packageImporter = require( 'node-sass-package-importer' );
const autoprefixer = require( 'autoprefixer' );
const postcss = require( 'postcss' );
const { Exception, FsInterface, isPojo, Timer } = require( '@squirrel-forge/node-util' );

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
         * Timer
         * @public
         * @property
         * @type {Timer}
         */
        this.timer = new Timer();

        /**
         * Console alike reporting object
         * @protected
         * @property
         * @type {console|null}
         */
        this._cfx = cfx;

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
            importer : [ packageImporter() ],
            functions : {},
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

        /**
         * Run sass in async
         * @public
         * @property
         * @type {boolean}
         */
        this.async = false;

        /**
         * Current/last run data
         * @type {null|Object}
         */
        this.last = null;

        /**
         * Builtin experimental names used
         * @protected
         * @property
         * @type {string[]}
         */
        this._x = [];
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
        if ( msg instanceof Error ) {
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
     * Use experimental by name
     * @public
     * @param {string} name - Name or module to use
     * @return {void}
     */
    useExperimental( name ) {
        if ( this._x.includes( name ) ) {
            throw new ScssBuilderException( 'Experimental feature already in use: ' + name );
        }
        const builtins = [ 'loadBase64' ];
        if ( builtins.includes( name ) ) {
            name = '../sass-functions/' + name;
        }
        let factory = null;
        try {
            factory = require( name );
        } catch ( e ) {
            throw new ScssBuilderException( 'Experimental factory not found: ' + name, e );
        }
        if ( typeof factory !== 'function' ) {
            throw new ScssBuilderException( 'Experimental factory must be a function: ' + name );
        }
        try {
            factory( sass, this );
        } catch ( e ) {
            throw new ScssBuilderException( 'Failed to run experimental factory for: ' + name, e );
        }
        this._x.push( name );
    }

    /**
     * Register experimental sass function
     * @public
     * @param {string} sig - Signature
     * @param {Function} fn - Function handler
     * @return {void}
     */
    registerExperimental( sig, fn ) {
        if ( typeof sig !== 'string' ) {
            throw new ScssBuilderException( 'Invalid function signature' );
        }
        if ( typeof fn !== 'function' ) {
            throw new ScssBuilderException( 'Invalid experimental function' );
        }
        this.options.functions[ sig ] = fn;
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
     * Render async
     * @protected
     * @param {Object} options - Sass options
     * @return {Promise<ScssBuilderException|Object>} - Sass render or exception
     */
    _renderAsync( options ) {
        return new Promise( ( resolve ) => {
            sass.render( options, ( err, result ) => {
                resolve( err || result );
            } );
        } );
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
    async renderFile( file, source, target, options = null ) {
        options = this._getSassOptions( options );
        const data = this._getFileData( file, source, target, options );

        // Set input/output
        options.file = file;
        options.outFile = data.target.path;

        // Render and return
        this.timer.start( 'render-' + data.source.path );
        let rendered;
        if ( this.async ) {
            rendered = await this._renderAsync( options );
            if ( rendered instanceof Error ) {
                throw rendered;
            }
        } else {
            rendered = sass.renderSync( options );
        }
        data.time.rendered = this.timer.measure( 'render-' + data.source.path );
        if ( rendered && rendered.stats ) {
            data.stats.rendered = rendered.stats;
        }
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
        const source_exists = await FsInterface.exists( resolved );
        if ( !source_exists ) {
            throw new ScssBuilderException( 'Source not found: ' + resolved );
        }

        // Convert to array for processing
        let files = [ resolved ], root = resolved;

        // Fetch files if source is a directory
        if ( FsInterface.isDir( resolved ) ) {
            files = FsInterface.fileList( resolved, { exclude : /\/_[^/]*\.scss$/, extensions : /\.scss/ } );

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
        let created = null, exists = await FsInterface.exists( resolved );
        if ( !exists ) {
            created = await FsInterface.dir( resolved );
            exists = true;
        }

        // Check for directory if not created
        if ( !created && !FsInterface.isDir( resolved ) ) {
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
        const rel = FsInterface.relative2root( file, source.root );
        const target_path = path.join( target.resolved, rel );
        let ext = this.outputExt;
        if ( options.outputStyle === 'compressed' ) {
            ext = this.outputCompressedExt;
        }
        return {
            source_root : source.root,
            target_root : target.resolved,
            source : this._getPathData( file ),
            target : this._getPathData( target_path, ext ),
            source_rel : '.' + path.sep + rel,
            target_rel : path.dirname( rel ) + path.sep
                + path.basename( target_path, path.extname( target_path ) ) + ext,
            map : null,
            time : { total : null, rendered : null, processed : null, write : null },
            stats : { rendered : null, processed : null },
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
        this.timer.start( 'process-' + file.data.source.path );
        file.processed = await postcss( this.processors ).process( file.rendered.css, options );
        file.data.time.processed = this.timer.measure( 'process-' + file.data.source.path );
        file.data.stats.processed = file.processed.messages;
    }

    /**
     * Run build
     * @param {string} source - Source path
     * @param {string} target - Target path
     * @param {null|function} allowrite - Before write callback
     * @param {null|function} complete - Complete callback
     * @return {Promise<{processed: number, sources: number, rendered: number, maps: number, written: number}>} - Stats
     */
    async run( source, target, allowrite = null, complete = null ) {
        this.timer.start( 'total-run' );
        source = await this._resolveSource( source );
        target = await this._resolveTarget( target );
        this.last = { source, target };

        const stats = {
            sources : source.files.length,
            rendered : 0,
            processed : 0,
            written : 0,
            maps : 0,
            files : [],
            time : null,
            dirs : {
                created : [],
                failed : [],
            },
        };

        for ( let i = 0; i < source.files.length; i++ ) {
            const fp = source.files[ i ];
            this.timer.start( 'total-' + fp );
            let file = null;
            try {
                file = await this.renderFile( fp, source, target );
                if ( file ) {
                    stats.rendered++;
                }
            } catch ( e ) {
                this.error( new ScssBuilderException( 'Render failed for: ' + fp, e ) );
            }
            if ( !file ) continue;
            stats.files.push( file.data );

            if ( this.postprocess ) {
                try {
                    await this.processFile( file );
                    if ( file.processed ) {
                        stats.processed++;
                    }
                } catch ( e ) {
                    this.error( new ScssBuilderException( 'PostCSS failed for: ' + fp, e ) );
                }
            }

            let write = true;
            if ( typeof allowrite === 'function' ) {
                write = await allowrite( file, stats, this );
            }
            if ( !write ) continue;

            this.timer.start( 'write-' + fp );
            let css = file.rendered.css.toString(), map = null;
            if ( this.postprocess && file.processed ) {
                css = file.processed.css.toString();
                if ( file.processed.map ) {
                    map = file.processed.map.toString();
                }
            } else if ( file.rendered.map ) {
                map = file.rendered.map.toString();
            }
            const wrote_css = await FsInterface.write( file.data.target.path, css );
            if ( !wrote_css ) {
                this.error( new ScssBuilderException( 'Failed to write: ' + file.data.target.path ) );
            } else {
                stats.written++;
            }
            if ( map ) {
                const wrote_map = await FsInterface.write( file.data.target.path + '.map', map );
                if ( !wrote_map ) {
                    this.error( new ScssBuilderException( 'Failed to write: ' + file.data.target.path + '.map' ) );
                } else {
                    file.data.map = file.data.target.path + '.map';
                    stats.maps++;
                }
            }
            file.data.time.write = this.timer.measure( 'write-' + fp );
            file.data.time.total = this.timer.measure( 'total-' + fp );

            if ( typeof complete === 'function' ) {
                await complete( file.data, stats, this );
            }
        }
        stats.time = this.timer.measure( 'total-run' );

        return stats;
    }
}

// Export Exception as static property constructor
ScssBuilder.ScssBuilderException = ScssBuilderException;
module.exports = ScssBuilder;
