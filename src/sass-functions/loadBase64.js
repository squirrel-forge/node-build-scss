/**
 * Requires
 */
const path = require( 'path' );
const fileType = require( 'file-type' );
const { Exception, FsInterface } = require( '@squirrel-forge/node-util' );

/**
 * ScssBuilder exception
 * @class
 */
class ScssLoadBase64Exception extends Exception {}

/**
 * Get from cache
 * @param {string} source - Source
 * @param {null|string} mime - Mime
 * @param {ScssBuilder} builder - Builder instane
 * @return {null|string} - Cached string if available
 */
function fromCache( source, mime, builder ) {
    const key = source + ( mime ? ':' + mime : '' );
    if ( builder._b64c[ key ] ) {
        return builder._b64c[ key ];
    }
    return null;
}

/**
 * Write to cache
 * @param {string} source - Source
 * @param {null|string} mime - Mime
 * @param {string} value - Value to cache
 * @param {ScssBuilder} builder - Builder instane
 * @return {void}
 */
function toCache( source, mime, value, builder ) {
    const key = source + ( mime ? ':' + mime : '' );
    builder._b64c[ key ] = value;
}

/**
 * Get base64 sass string from local file
 * @param {string} source - Source
 * @param {null|string} mime - Mime
 * @param {sass} sass - Sass module
 * @param {ScssBuilder} builder - Builder instane
 * @return {Promise<String>} - Sass string
 */
async function base64Local( source, mime, sass, builder ) {

    // Check cache
    const imime = mime;
    const cached = fromCache( source, imime, builder );
    if ( cached ) {
        return new sass.types.String( cached );
    }

    // Resolve local file path
    const file_path = path.resolve( builder.last.source.resolved, source );
    const file_exists = await FsInterface.exists( file_path );
    if ( !file_exists ) {
        throw new ScssLoadBase64Exception( 'File not found: ' + file_path );
    }

    // Require mimetype
    if ( !mime ) {
        const type = await fileType.fromFile( file_path );
        if ( type && type.mime ) {
            mime = type.mime;
        }
    }
    if ( !mime ) {
        throw new ScssLoadBase64Exception( 'Failed to detect mimetype of: ' + file_path );
    }

    // Load file
    const buf = await FsInterface.read( file_path, 'base64' );
    const output = `"data:${mime};base64,${buf.toString()}"`;
    toCache( source, imime, output, builder );
    return new sass.types.String( output );
}

/**
 * Load base64 factory
 * @param {sass} sass - Sass module
 * @param {ScssBuilder} builder - Builder instance
 * @return {void}
 */
module.exports = function makeLoadBase64Func( sass, builder ) {

    // Force async mode
    builder.async = true;

    // Create internal cache property
    if ( !builder._b64c ) {
        builder._b64c = {};
    }

    /**
     * Load source as base64 data uri
     * @param {sass.types.String} source - Source path, url/uri
     * @param {sass.types.Null|sass.types.String} mime - Mimetype
     * @param {Function} done - Complete callback
     * @return {sass.types.String} - Encoded value
     */
    const loadBase64 = function loadBase64( source, mime, done ) {
        if ( source && typeof source.getValue !== 'function' ) {
            throw new ScssLoadBase64Exception( 'Load base64 invalid source argument type' );
        }
        if ( typeof done !== 'function' ) {
            throw new ScssLoadBase64Exception( 'Load base64 requires async mode' );
        }
        const mime_value = typeof mime.getValue === 'function' ? mime.getValue() : null;
        base64Local( source.getValue(), mime_value, sass, builder ).then( done ).catch( done );
    };

    // Register function
    builder.registerExperimental( 'load-base64($source,$mime:null)', loadBase64 );
};
