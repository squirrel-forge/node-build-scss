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

        // Minify the output
        minify : [ '-c', '--compressed', false, true ],

        // Generate sourcemaps
        map : [ '-m', '--with-map', false, true ],

        // Do not run postcss
        postcss : [ '-p', '--no-postcss', false, true ],

        // Color limits
        colors : [ '-w', '--colors', '', false ],

        // Do not break on any error, disables the default strict if set
        loose : [ '-u', '--loose', null, true ],

    } );

    // Show version
    if ( options.version ) {
        const install_dir = path.resolve( __dirname, '../' );
        let pkg;
        try {
            pkg = require( path.join( install_dir, 'package.json' ) );
        } catch ( e ) {
            cfx.error( e );
            process.exit( 1 );
        }
        cfx.log( pkg.name + '@' + pkg.version );
        cfx.info( '- Installed at: ' + install_dir );
        process.exit( 0 );
    }

    // Init application
    const scssB = new ScssBuilder( cfx );

    // Set minify and sourcemap options
    if ( options.loose ) {
        scssB.strict = false;
    }
    scssB.verbose = options.verbose;
    scssB.options.outputStyle = options.minify ? 'compressed' : 'expanded';
    scssB.options.sourceMap = options.map;
    scssB.postprocess = options.postcss ? false : { map : options.map ? { inline : false } : false  };

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
     * @param {Object} file - File object
     * @return {Array<string>} - Styled file stats parts
     */
    const getFileStats = ( file ) => {
        const output = [];

        // File from path
        output.push( '- ' + stDi.show( [ file.source_rel, 'path' ], true ) );

        // Full stats if written
        if ( file.time.write ) {

            // Make extra stats output
            if ( options.stats ) {

                // Begin bracket block
                output.push( '[fred][[re]' );

                if ( file.stats.rendered && file.stats.rendered.includedFiles ) {
                    output.push( stDi.show( [ [
                        'Includes:',
                        [ leadingZeros( file.stats.rendered.includedFiles.length, 3, ' ' ), 'number' ],
                    ], 'asline' ], true ) );
                }

                // File size
                const stat = fs.statSync( file.target.path );
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
                output.push( leadingZeros( stDi.show( [ file.time.total, 'time' ], true ), 35, ' ' ) );

                // End bracket block
                output.push( '[fred]]' );
            } else {
                output.push( '[fred]>[re]' );
            }

            // File to path
            output.push( stDi.show( [ file.target_rel, 'path' ], true ) );

            // Output map
            if ( file.map ) {
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
     * @param {Object} file - File object
     * @param {Object} stats - Stats object
     * @param {ScssBuilder} builder - Builder instance
     * @return {void}
     */
    const statsFetcher = ( file, stats, builder ) => {

        // Stop the spinner, is updated with process count after output
        builder.strict && spinner.stop();

        // Generate informational output if requested
        if ( builder.verbose ) {
            cfx.info( getFileStats( file ).join( ' ' ) );
        }

        // Start the spinner with a count of the files processed
        const new_spinner = 'Built ('
            + ( leadingZeros( file_count, ( stats.sources + '' ).length, ' ' ) + '/' + stats.sources )
            + ')... ';
        builder.strict && spinner.start( new_spinner );
        file_count++;
    };

    // Begin processing
    scssB.strict && spinner.start( 'Building... ' );
    let stats;
    try {

        // Run render, process and write
        stats = await scssB.run( source, target, null, statsFetcher );
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
        if ( stats.maps ) {
            if ( stats.sources !== stats.maps ) {
                so.Overview.Files[ 0 ].push( 'Maps:' );
                so.Overview.Files[ 0 ].push( stats.maps );
            } else {
                so.Overview.Files[ 0 ].push( 'with map' + ( stats.maps === 1 ? '' : 's' ) );
            }
        }
        if ( !options.verbose ) {
            const files_prop = 'Render and processing details';
            for ( let i = 0; i < stats.files.length; i++ ) {
                const file = stats.files[ i ];
                if ( !so[ files_prop ] ) so[ files_prop ] = [];
                so[ files_prop ].push( [ getFileStats( file ).join( ' ' ), 'none' ] );
            }
        }

        // Show generated stats
        stDi.display( so );
    }

    // End application
    process.exit( 0 );
};
