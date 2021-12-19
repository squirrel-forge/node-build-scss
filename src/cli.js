/**
 * Requires
 */
const path = require( 'path' );
const { cfx } = require( '@squirrel-forge/node-cfx' );
const { CliInput, Progress, Timer, FsInterface } = require( '@squirrel-forge/node-util' );
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

    // Notify strict mode
    if ( scssB.strict && scssB.verbose ) {
        cfx.warn( 'Running in strict mode!' );
    }

    // Define stats fetcher
    let statsFetcher = null;
    if ( options.stats ) {

        /**
         * Fetch stats from file
         * @param {Object} file - File object
         * @param {Object} stats - Stats object
         * @param {ScssBuilder} builder - Builder instance
         * @return {boolean} - Write file, always true
         */
        statsFetcher = ( file, stats, builder ) => {
            if ( !( stats.files instanceof Array ) ) {
                stats.files = [];
            }
            const display_source = options.verbose ? file.data.source.path
                : FsInterface.relative2root( file.data.source.path, file.data.source_root );
            const display_target = options.verbose ? file.data.target.path
                : FsInterface.relative2root( file.data.target.path, file.data.target_root );
            stats.files.push( [ display_source, display_target ] );
            return true;
        };
    }

    // Init progress spinner and start count
    const spinner = new Progress();

    scssB.strict && spinner.start( 'Building... ' );
    let stats;
    try {

        // Run render, process and write
        stats = await scssB.run( source, target, statsFetcher );
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
        cfx.log( '[fmagenta][ [fwhite]Stats [fmagenta]][re]' );
        const entries = Object.entries( stats );
        for ( let i = 0; i < entries.length; i++ ) {
            const [ key, value ] = entries[ i ];
            let display_value = value, complex_value;
            switch ( typeof value ) {
            case 'object' :
                complex_value = value;
                display_value = '';
                break;
            case 'number' :
                display_value = ': [fwhite]' + display_value;
                break;
            default :
                display_value = ' [fwhite]' + display_value;
            }
            cfx.info( ' - ' + key + display_value );
            if ( complex_value ) {
                if ( complex_value instanceof Array ) {
                    for ( let j = 0; j < complex_value.length; j++ ) {
                        const cmplx = complex_value[ j ];
                        cfx.info( '   - [fwhite]' + ( cmplx instanceof Array ? cmplx.join( '[fcyan] > [fwhite]' ) : cmplx ) );
                    }
                }
            }
        }
    }

    // End application
    process.exit( 0 );
};
