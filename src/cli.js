/**
 * Requires
 */
const fs = require( 'fs' );
const path = require( 'path' );
const { cfx } = require( '@squirrel-forge/node-cfx' );
const { CliInput, Progress, Timer, leadingZeros, StatsDisplay, convertBytes, FsInterface } = require( '@squirrel-forge/node-util' );
const ScssBuilder = require( './classes/ScssBuilder' );

/**
 * Build Scss cli application
 * @return {Promise<void>} - Possibly throws errors in strict mode
 */
module.exports = async function cli() {

    // Timer
    const timer = new Timer();

    // Input
    const input = new CliInput( cfx );

    // Main arguments
    let source = input.arg( 0 ) || '',
        target = input.arg( 1 ) || '';
    if ( !target.length ) {
        target = source;
        source = '';
    }

    // Cli application options
    const options = input.getFlagsOptions( {

        // Show version
        version : [ '-v', '--version', false, true ],

        // Show more output
        stats : [ '-s', '--stats', false, true ],

        // Show more output
        verbose : [ '-i', '--verbose', false, true ],

        // Production mode
        prod : [ '-p', '--production', false, true ],

        // Development mode
        dev : [ '-d', '--development', false, true ],

        // Environment name
        env : [ '-e', '--env', null, false ],

        // Minify the output
        minify : [ '-c', '--compressed', false, true ],

        // Generate sourcemaps
        map : [ '-m', '--with-map', false, true ],

        // Set options source directory
        options : [ '-o', '--options', true, false ],

        // A list of experimental features to use
        experimental : [ '-x', '--experimental', null, true, true ],

        // Do not run postcss
        nopostcss : [ '-p', '--no-postcss', false, true ],

        // Color limits
        colors : [ ' ', '--colors', '', false ],

        // Deploy empty plugins default config to target
        config : [ ' ', '--defaults', false, true ],

        // Do not break on any error, disables the default strict if set
        loose : [ '-u', '--loose', null, true ],

    } );

    // Cannot force dev and prod mode
    if ( options.dev && options.prod ) {
        cfx.error( 'Cannot force production and development mode at the same time' );
        process.exit( 1 );
    }

    // Init application
    const scssB = new ScssBuilder( cfx );

    // Show version
    if ( options.version ) {
        cfx.log( scssB.pkg.name + '@' + scssB.pkg.version );
        if ( options.verbose ) {
            cfx.info( '- Installed at: ' + path.resolve( __dirname, '../' ) );
        }
        process.exit( 0 );
    }

    // Deploy default config
    if ( options.config ) {
        const config_data = require( './defaults.json' );
        const resolved = path.resolve( target, scssB.pluginsOptionsName );
        const config_exists = await FsInterface.exists( resolved );
        if ( config_exists ) {
            cfx.error( 'Config file already exists: ' + resolved );
        } else {
            const wrote = await FsInterface.write( resolved, JSON.stringify( config_data, null, 2 ) );
            if ( wrote ) {
                cfx.success( 'Created plugins defaults config: ' + resolved );
            } else {
                cfx.error( 'Failed to write config: ' + resolved );
            }
        }
        process.exit( 0 );
    }

    // Development mode shortcut
    if ( options.dev ) {
        options.env = 'development';
        options.loose = true;
        options.nopostcss = true;
        options.map = true;
        options.experimental = options.experimental ? options.experimental : true;
        options.stats = true;
        options.verbose = true;
    }

    // Production mode shortcut
    if ( options.prod ) {
        options.env = 'production';
        options.loose = false;
        options.minify = true;
        options.nopostcss = false;
        options.stats = true;
    }

    // Disable default strict mode
    if ( options.loose ) {
        scssB.strict = false;
    }

    // Enable verbose output
    scssB.verbose = options.verbose;

    // Set env
    scssB.env = options.env;

    // Minify/compressed output
    scssB.options.style = options.minify ? 'compressed' : 'expanded';

    // Set sourcemaps
    scssB.options.sourceMap = options.map;
    scssB.postcss.options.map = options.map ? { inline : false } : false;

    // Allow no postcss with option active
    scssB.process = !options.nopostcss;

    // Color warning option must be an Array
    if ( !( options.colors instanceof Array ) ) {
        options.colors = options.colors.split( ',' )
            .filter( ( v ) => { return !!v.length; } )
            .map( ( x ) => { return parseInt( x, 10 ) * 1024; } );
    }

    // Use default color if not enough defined
    if ( options.colors.length !== 3 ) {

        // Notify user if something is defined
        if ( options.verbose && options.colors.length ) {
            cfx.info( 'Using default coloring, [fwhite]-c[fcyan] or [fwhite]--colors'
                + ' [fcyan]must contain 3 incrementing kib limit integers' );
        }

        // Set default coloring limits
        options.colors = [ 100 * 1024, 200 * 1024, 300 * 1024 ];
    }
    const [ mark_green, mark_yellow, mark_red ] = options.colors;

    // Disable plugin options file
    if ( input._f.includes( options.options ) ) {

        // Load no options
        scssB.pluginsOptionsPath = false;

    } else if ( options.options && options.options.length ) {

        // Set as options path
        scssB.pluginsOptionsPath = options.options;
    }

    // Plugins and experimental features
    const xuse = [];
    if ( options.experimental ) {
        const xshorthands = {
            pi : '@squirrel-forge/sass-package-importer',
            b64 : '@squirrel-forge/sass-base64-loader',
        };

        // Enable all if set as boolean flag
        if ( options.experimental === true ) {
            options.experimental = 'all';
        }

        // Use all shorthand plugins
        if ( options.experimental === 'all' ) {
            const xavailable = Object.values( xshorthands );
            xuse.push( ...xavailable );
        } else {

            // Parse option value and add features/plugins to use list
            const parsed = options.experimental.split( ',' ).filter( ( v ) => { return !!v.length; } );
            if ( parsed.length ) {
                for ( let i = 0; i < parsed.length; i++ ) {

                    // Add the defined full name for shorthand
                    if ( xshorthands[ parsed[ i ] ] ) {
                        xuse.push( xshorthands[ parsed[ i ] ] );
                    } else {

                        // Custom feature/plugin
                        xuse.push( parsed[ i ] );
                    }
                }
            }
        }

        // Always notify if using plugins
        if ( xuse.length ) {
            cfx.warn( 'Using plugins/experimental features' );
        }

        // Notify plugins
        for ( let i = 0; i < xuse.length; i++ ) {
            scssB.verbose && cfx.info( ' - ' + xuse[ i ] );
        }
    }

    // Notify strict mode
    if ( scssB.strict && scssB.verbose ) {
        cfx.warn( 'Running in strict mode!' );
    }

    // Init progress spinner, stats and count
    const spinner = new Progress();
    const stDi = new StatsDisplay( cfx );
    let file_count = 1;

    /**
     * Get file stats data as array
     * @param {Object|ScssBuildData} bdata - Build data object
     * @return {Array<string>} - Styled file stats parts
     */
    const getFileStats = ( bdata ) => {
        const output = [];

        // File from path
        output.push( '- ' + stDi.show( [ bdata.input.rel, 'path' ], true ) );

        // Full stats if written
        if ( bdata.time.written ) {

            // Make extra stats output
            if ( options.stats ) {

                // Begin bracket block
                output.push( '[fred][[re]' );

                // Show number of included files
                if ( bdata.stats.rendered ) {
                    output.push( stDi.show( [ [
                        'Includes:',
                        [ leadingZeros( bdata.stats.rendered.length, 3, ' ' ), 'number' ],
                    ], 'asline' ], true ) );
                }

                // File size
                const stat = fs.statSync( bdata.output.path );
                if ( stat ) {
                    output.push( stDi.show( 'Output:', true ) );

                    // Show output size
                    let size_color = 'none';
                    if ( stat.size <= mark_green ) {
                        size_color = 'valid';
                    } else if ( stat.size <= mark_yellow ) {
                        size_color = 'notice';
                    } else if ( stat.size > mark_red ) {
                        size_color = 'error';
                    }
                    output.push( stDi.show( [ leadingZeros( convertBytes( stat.size ), 11, ' ' ) + ' ', size_color ], true ) );
                }

                // File total time
                output.push( stDi.show( 'in', true ) );
                output.push( leadingZeros( stDi.show( [ bdata.time.total, 'time' ], true ), 35, ' ' ) );

                // End bracket block
                output.push( '[fred]]' );
            } else {
                output.push( '[fred]>[re]' );
            }

            // File to path
            output.push( stDi.show( [ bdata.output.rel, 'path' ], true ) );

            // Output map
            if ( bdata.map ) {
                output.push( '[fred]([fcyan].map[fred])[re]' );
            }
        } else {

            // Did not write
            output.push( stDi.show( [ 'Skipped', 'fatal' ], true ) );
        }

        return output;
    };

    /**
     * Fetch stats from file
     * @param {Object|ScssBuildData} bdata - Build data object
     * @param {Object|ScssBuilderStats} stats - Stats object
     * @param {ScssBuilder} builder - Builder instance
     * @return {void}
     */
    const statsFetcher = ( bdata, stats, builder ) => {

        // Stop the spinner, is updated with process count after output
        builder.strict && spinner.stop();

        // Generate informational output if requested
        if ( builder.verbose ) {
            cfx.info( getFileStats( bdata ).join( ' ' ) );
        }

        // Start the spinner with a count of the files processed
        const new_spinner = 'Built ('
            + ( leadingZeros( file_count, ( stats.sources + '' ).length, ' ' ) + '/' + stats.sources )
            + ')... ';
        builder.strict && spinner.start( new_spinner );
        file_count++;
    };

    // Begin processing
    if ( scssB.verbose ) {
        cfx.info( 'Reading from: ' + stDi.show( [ path.resolve( source ), 'path' ], true ) );
    }
    scssB.strict && spinner.start( 'Building... ' );
    let stats;
    try {

        // Run render, process and write
        stats = await scssB.run( source, target, statsFetcher, xuse );
    } catch ( e ) {
        scssB.strict && spinner.stop();

        // Generate cleaner exception output only full trace on verbose
        const error = new ScssBuilder.ScssBuilderException( 'Something went wrong', e );
        scssB.error( scssB._exceptionAsOutput( error, !scssB.verbose ) );
        process.exit( 1 );
    }

    // If we did not crash, stop spinner and inform user
    scssB.strict && spinner.stop();

    // Output result info
    if ( !stats.written ) {
        if ( stats.sources ) {
            cfx.warn( 'build-scss did not write any files!' );
        } else {

            // Warn user since there were no sources detected
            cfx.error( 'build-scss did not find any files!' );
        }
        if ( scssB.verbose ) {
            cfx.info( 'Completed after [fwhite]' + timer.end( 'construct' ) );
        }
    } else {
        if ( scssB.verbose ) {
            cfx.info( 'Wrote to: ' + stDi.show( [ path.resolve( target ), 'path' ], true ) );
        }

        // Show a few details at least when something was written
        cfx.success( 'build-scss wrote [ ' + stats.written
            + ' ] file' + ( stats.written === 1 ? '' : 's' ) + ' in ' + timer.end( 'construct' ) );
    }

    // Generate stats on request only
    if ( options.stats ) {
        const so = {
            Overview : {
                Files : [ [ 'Sources:', stats.sources ], 'asline' ],
                Time : [ stats.time, 'time' ],
            },
        };
        if ( !scssB.verbose ) {
            so.Overview.Source = [ path.resolve( source ), 'path' ];
            so.Overview.Target = [ path.resolve( target ), 'path' ];
        }
        if ( stats.sources !== stats.rendered ) {
            so.Overview.Files[ 0 ].push( 'Rendered:' );
            so.Overview.Files[ 0 ].push( stats.rendered );
        }
        if ( stats.sources !== stats.processed ) {
            so.Overview.Files[ 0 ].push( 'Processed:' );
            so.Overview.Files[ 0 ].push( stats.processed );
        }
        if ( stats.sources !== stats.written ) {
            so.Overview.Files[ 0 ].push( 'Wrote:' );
            so.Overview.Files[ 0 ].push( stats.written );
        }
        if ( options.map && stats.written ) {
            so.Overview.Files[ 0 ].push( 'with map' + ( stats.written === 1 ? '' : 's' ) );
        }
        if ( stats.options ) {
            so.Overview[ 'Options loaded from' ] = [ stats.options, 'path' ];
        }
        if ( !options.verbose ) {
            const files_prop = 'Render and processing details';
            for ( let i = 0; i < stats.files.length; i++ ) {
                const bdata = stats.files[ i ];
                if ( !so[ files_prop ] ) so[ files_prop ] = [];
                so[ files_prop ].push( [ getFileStats( bdata ).join( ' ' ), 'none' ] );
            }
        }

        // Show generated stats
        stDi.display( so );
    }

    // End application
    process.exit( 0 );
};
