/**
 * Requires
 */
const path = require( 'path' );
const sass = require( 'sass' );
const autoprefixer = require( 'autoprefixer' );
const postcss = require( 'postcss' );
const { Exception, FsInterface, isPojo, Timer } = require( '@squirrel-forge/node-util' );
const ScssBuildData = require( './ScssBuildData' );

/**
 * ScssBuilder exception
 * @class
 */
class ScssBuilderException extends Exception {}

/**
 * ScssBuilder class
 * @class
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
         * Package
         * @public
         * @property
         * @type {Object}
         */
        this.pkg = require( '../../package.json' );

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
         * Environment name
         * @public
         * @property
         * @type {null|string}
         */
        this.env = null;

        /**
         * Sass options
         * @public
         * @property
         * @type {Object}
         */
        this.options = {
            style : 'compressed',
            sourceMap : true,
            importers : [],
            functions : {},
            alertColor : true,
        };

        /**
         * Run additional processing
         * @public
         * @property
         * @type {boolean}
         */
        this.process = true;

        /**
         * Postcss processors and options
         * @public
         * @property
         * @type {Object}
         */
        this.postcss = {
            processors : [ autoprefixer ],
            options : { map : { inline : false } }
        };

        /**
         * Current run data
         * @public
         * @property
         * @type {null|Object}
         */
        this.current = null;

        /**
         * Plugin options
         * @public
         * @property
         * @type {Object}
         */
        this.plugins = {};

        /**
         * Plugins options path
         * @public
         * @property
         * @type {null|string}
         */
        this.pluginsOptionsPath = null;

        /**
         * Plugins options name
         * @public
         * @property
         * @type {string}
         */
        this.pluginsOptionsName = '.build-scss';

        /**
         * Plugin names loaded
         * @protected
         * @property
         * @type {Array<string>}
         */
        this._loaded = [];
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
     * Load plugins config
     * @protected
     * @param {Object} source - Source object
     * @return {Promise<string|null>} - Loaded path or null on empty
     */
    async _loadPluginsConfig( source ) {
        let data = null, from = null;

        // Prioritize from options if available
        if ( this.pluginsOptionsPath && this.pluginsOptionsPath.length ) {
            const from_options = path.join( this.pluginsOptionsPath, this.pluginsOptionsName );
            const options_exists = await FsInterface.exists( from_options );
            if ( options_exists ) {
                data = await FsInterface.readJSON( from_options );
                from = from_options;
            }
        }

        // Only attempt further loading if not disabled
        if ( !data && this.pluginsOptionsPath !== false ) {

            // Check current working directory
            const from_cwd = path.join( process.cwd(), this.pluginsOptionsName );
            const cwd_exists = await FsInterface.exists( from_cwd );
            if ( cwd_exists ) {

                // Config loaded from cwd
                data = await FsInterface.readJSON( from_cwd );
                from = from_cwd;
            } else {

                // Check source root directory
                const from_source = path.join( source.root, this.pluginsOptionsName );
                const source_exists = await FsInterface.exists( from_source );
                if ( source_exists ) {

                    // Config loaded form source root
                    data = await FsInterface.readJSON( from_source );
                    from = from_source;
                }
            }
        }

        // Assign config if one is loaded and not empty
        if ( data && isPojo( data ) && Object.keys( data ).length ) {
            Object.assign( this.plugins, data );
        }

        // Return origin
        return from;
    }

    /**
     * Use plugin by name
     * @protected
     * @param {string} name - Name, path or module to use
     * @param {null|Object} options - Plugin options
     * @param {null|Function} setter - Plugin setter
     * @return {void}
     */
    _usePlugin( name, options = null, setter = null ) {
        let load_path = name;

        // Fetch separated name and load path
        if ( name.indexOf( ':' ) > -1 ) {
            const p = name.split( ':' ).filter( ( v ) => { return !!v.length; } );
            if ( p.length < 2 ) {
                throw new ScssBuilderException( 'Invalid plugin name:path definition: ' + name );
            }
            name = p.shift();
            load_path = p.join( ':' );
        }

        // Name already loaded
        if ( this._loaded.includes( name ) ) {
            throw new ScssBuilderException( 'Plugin already loaded: ' + name );
        }

        // Attempt to load plugin
        let plugin = null;
        try {
            plugin = require( load_path );
        } catch ( e ) {
            throw new ScssBuilderException( 'Plugin not found: ' + name, e );
        }
        if ( typeof plugin !== 'function' ) {
            throw new ScssBuilderException( 'Plugin must be a function: ' + name );
        }

        // Check local options or get options from plugins object
        if ( !options && this.plugins[ name ] && this.plugins[ name ].options ) {
            options = this.plugins[ name ].options;
        }

        // Run plugin
        try {
            plugin( options, this.options, this );
        } catch ( e ) {
            throw new ScssBuilderException( 'Failed to run experimental factory for: ' + name, e );
        }

        // Mark as loaded
        this._loaded.push( name );
    }

    /**
     * @typedef {Object} ScssSourceObject
     * @property {string} root - Root path
     * @property {Array<string>} files - List of absolute source file paths
     * @property {string} source - Original source string
     * @property {string} resolved - Resolved source path
     */

    /**
     * Resolve source
     * @public
     * @param {string} source - Source path
     * @return {Promise<ScssSourceObject>} - Source object
     */
    async resolveSource( source ) {

        // Resolve source
        const resolved = path.resolve( source );

        // Require valid source
        const source_exists = await FsInterface.exists( resolved );
        if ( !source_exists ) {
            throw new ScssBuilderException( 'Source not found: ' + resolved );
        }

        // Convert to array for processing^
        let files = [ resolved ], root = resolved;

        // Fetch files if source is a directory
        if ( FsInterface.isDir( resolved ) ) {
            files = FsInterface.fileList( resolved, { exclude : /\/_[^/]*\.(sass|scss)$/, extensions : /\.(sass|scss)/ } );

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
     * @typedef {Object} ScssTargetObject
     * @property {string} root - Root path (same as resolved)
     * @property {string} target - Original target string
     * @property {string} resolved - Resolved target path
     * @property {boolean} created - True if the directory had to be created
     */

    /**
     * Resolve target
     * @public
     * @param {string} target - Target source
     * @return {Promise<ScssTargetObject>} - Target object
     */
    async resolveTarget( target ) {

        // Resolve target
        const resolved = path.resolve( target );

        // Attempt create
        let created = false;
        const exists = await FsInterface.exists( resolved );
        if ( !exists ) {
            created = await FsInterface.dir( resolved );
        }

        // Check for directory if not created
        if ( !created && !FsInterface.isDir( resolved ) ) {
            throw new ScssBuilderException( 'Target must be a directory: ' + resolved );
        }
        const root = resolved;
        return { root, target, resolved, created };
    }

    /**
     * Get sass options
     * @param {null|Object} options - Sass options
     * @throws ScssBuilderException
     * @return {Object} - Sass options object
     */
    getSassOptions( options ) {
        if ( options === null ) {
            options = this.options;
        }
        if ( !isPojo( options ) ) {
            throw new ScssBuilderException( 'Invalid sass options object' );
        }
        options.verbose = this.verbose;
        return options;
    }

    /**
     * Get importer root template
     * @param {string} env - Environment name
     * @param {string} source - Import source path
     * @param {string} prepend - Prepend sass string
     * @return {string} - Sass importer template
     */
    sassRootTemplate( { env, source, prepend = '' } = {} ) {
        if ( typeof env !== 'string' ) {
            throw ScssBuilderException( 'Env must be a string' );
        }
        if ( typeof source !== 'string' || !source.length ) {
            throw ScssBuilderException( 'Source must be a string and not empty' );
        }
        if ( typeof prepend !== 'string' ) {
            throw ScssBuilderException( 'Prepend must be a string' );
        }
        const isProduction = env === 'production' ? 'true' : 'false';
        return '/**\n'
            + ` * ${this.pkg.name}@${this.pkg.version}\n`
            + ' * Root render template\n'
            + ` *  Set $env: ${env}\n`
            + ` *  Set $production: ${isProduction}\n`
            + ` *  Import: ${source};\n`
            + ' */\n'
            + `$env: ${env};\n`
            + `$production: ${isProduction};\n`
            + prepend + '\n'
            + `@import "${source}";\n`;
    }

    /**
     * Compile sass
     * @param {Object|ScssBuildData} bdata - Build data object
     * @param {null|Object} options - Sass options
     * @throws ScssBuilderException
     * @return {Promise<boolean>} - True on success
     */
    async renderBuildData( bdata, options = null ) {
        options = this.getSassOptions( options );

        // We require the primary import as load path, lets ensure it's the first
        if ( options.loadPaths instanceof Array ) {
            options.loadPaths.unshift( bdata.input.dir );
        } else {
            options.loadPaths = [ bdata.input.dir ];
        }

        // Prepare the root render template
        const template = this.sassRootTemplate( {
            env : this.env || 'null',
            source : bdata.input.rel,
            prepend : '',
        } );

        // Let sass do its magic
        const result = await sass.compileStringAsync( template, options );

        // Save data to build data
        if ( result && result.css ) {
            bdata.css = result.css;
            bdata.map = result.sourceMap || null;
            bdata.stats.rendered = result.loadedUrls;
            return true;
        }

        // File generated was empty
        if ( result && !result.css.length ) {
            throw new ScssBuilderException( 'Source file generated no output' );
        }

        // There is a bug if this happens
        throw new ScssBuilderException( 'Unknown error while rendering build data' );
    }

    /**
     * Get process options
     * @param {null|Object} options - Process options
     * @throws ScssBuilderException
     * @return {Object} - Process options object
     */
    getProcessOptions( options ) {
        if ( options === null ) {
            options = this.postcss.options;
        }
        if ( !isPojo( options ) ) {
            throw new ScssBuilderException( 'Invalid process options object' );
        }
        return options;
    }

    /**
     * Process build data input
     * @param {Object|ScssBuildData} bdata - Build data object
     * @param {null|Object} options - Process options
     * @throws ScssBuilderException
     * @return {Promise<boolean>} - True on success
     */
    async processBuildData( bdata, options = null ) {
        options = this.getProcessOptions( options );

        // We require the real input and output paths and let pass on the map from sass
        options.from = bdata.input.path;
        options.to = bdata.output.path;
        if ( bdata.map ) options.map.prev = bdata.map;

        // Let postcss do it's thing
        const result = await postcss( this.postcss.processors ).process( bdata.css, options );

        // Save data to build data
        if ( result && result.css ) {
            bdata.css = result.css;
            bdata.map = result.map;
            bdata.stats.processed = result.messages;
            return true;
        }

        // There is a bug if this happens
        throw new ScssBuilderException( 'Unknown error while rendering build data' );
    }

    /**
     * Write build data output
     * @param {Object|ScssBuildData} bdata - Build data object
     * @throws ScssBuilderException
     * @return {Promise<boolean>} - True on success
     */
    async writeBuildData( bdata ) {

        // Write css file
        const wrote_css = await FsInterface.write( bdata.output.path, bdata.css );
        if ( !wrote_css ) {
            throw new ScssBuilderException( 'Failed to write: ' + bdata.output.path );
        }

        // Write map file
        let wrote_map = true;
        if ( bdata.map ) {
            wrote_map = await FsInterface.write( bdata.output.path + '.map', bdata.map );
            if ( !wrote_map ) {
                throw new ScssBuilderException( 'Failed to write: ' + bdata.output.path + '.map' );
            }
        }

        // Wrote css and map if available
        if ( wrote_css === true && wrote_map === true ) {
            return true;
        }

        // There is a bug if this happens
        throw new ScssBuilderException( 'Unknown error while writing build data' );
    }

    /**
     * @typedef {Object} ScssBuilderStats
     * @property {number} sources - Number of source files
     * @property {number} rendered - Number of rendered files
     * @property {number} processed - NUmber of processed files,
     * @property {number} written - Number of written files,
     * @property {Array<ScssBuildData>} files - Array of build data objects
     * @property {Array<number, number>} time - Total time, in hrtime format
     */

    /**
     * Run build
     * @param {string} source - Source path
     * @param {string} target - Target path
     * @param {null|function} complete - Complete callback
     * @param {null|Array<string>} plugins - Plugin names or references to load
     * @return {Promise<ScssBuilderStats>} - Stats
     */
    async run( source, target, complete = null, plugins = null ) {
        this.timer.start( 'total-run' );
        source = await this.resolveSource( source );
        target = await this.resolveTarget( target );
        this.current = { source, target };

        /**
         * Global stats
         * @type {ScssBuilderStats}
         */
        const stats = {
            sources : source.files.length,
            rendered : 0,
            processed : 0,
            written : 0,
            files : [],
            time : null,
        };

        // Load plugin options file if available
        try {
            stats.options = await this._loadPluginsConfig( source );
        } catch ( err ) {
            this.error( new ScssBuilderException( 'Failed to load plugins options config', err ) );
        }

        // Load plugins if requested
        if ( plugins && plugins instanceof Array ) {
            for ( let i = 0; i < plugins.length; i++ ) {
                try {
                    this._usePlugin( plugins[ i ] );
                } catch ( err ) {
                    this.error( err );
                }
            }
        }

        // Cycle all source files
        for ( let i = 0; i < source.files.length; i++ ) {
            const file = source.files[ i ];

            // Start stats timer and create build data
            this.timer.start( 'total-' + file );
            const bdata = new ScssBuildData( file, source, target, {
                append : this.getSassOptions( null ).style === 'compressed' ? '.min' : ''
            } );
            stats.files.push( bdata );

            // Attempt to render build data or skip along on error
            this.timer.start( 'render-' + file );
            try {
                const rendered = await this.renderBuildData( bdata );
                if ( rendered ) stats.rendered++;
            } catch ( err ) {
                bdata.errors = err;
                this.error( new ScssBuilderException( 'Render failed for: ' + file, err ) );
                continue;
            }
            bdata.time.rendered = this.timer.measure( 'render-' + file );

            // Run postcss with the current build data if required
            if ( this.process ) {
                this.timer.start( 'process-' + file );
                try {
                    const processed = await this.processBuildData( bdata );
                    if ( processed ) stats.processed++;
                } catch ( err ) {
                    bdata.errors = err;
                    this.error( new ScssBuilderException( 'Process failed for: ' + file, err ) );
                    continue;
                }
                bdata.time.processed = this.timer.measure( 'process-' + file );
            }

            // Attempt to write build data or skip along
            this.timer.start( 'write-' + file );
            try {
                const written = await this.writeBuildData( bdata );
                if ( written ) stats.written++;
            } catch ( err ) {
                bdata.errors = err;
                this.error( new ScssBuilderException( 'Write failed for: ' + file, err ) );
                continue;
            }
            bdata.time.written = this.timer.measure( 'write-' + file );

            // Record file total time
            bdata.time.total = this.timer.measure( 'total-' + file );

            // Call complete for the current file
            if ( typeof complete === 'function' ) {
                await complete( bdata, stats, this );
            }

            // Clear any memory of data that is not needed anymore
            bdata.clearMemory();
        }

        // Reset current
        this.current = null;

        // Record total time and return
        stats.time = this.timer.measure( 'total-run' );
        return stats;
    }
}

// Export Exception and related classes as static property constructor
ScssBuilder.ScssBuilderException = ScssBuilderException;
ScssBuilder.ScssBuildData = ScssBuildData;
module.exports = ScssBuilder;
