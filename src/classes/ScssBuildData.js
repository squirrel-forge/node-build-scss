/**
 * Requires
 */
const path = require( 'path' );
const { FsInterface } = require( '@squirrel-forge/node-util' );

/**
 * ScssBuildData
 * @class
 */
module.exports = class ScssBuildData {

    /**
     * Constructor
     * @param {string} file - Absolute file path
     * @param {Object|ScssSourceObject} source - Source object
     * @param {Object|ScssTargetObject} target - Target object
     * @param {string} append - Append something like .min to the filename (technically added via extension)
     * @param {string} ext - Transform the file extension
     */
    constructor( file, source, target, { append = '', ext = '.css' } = {} ) {
        this.file = file;
        this.source = source;
        this.target = target;
        this.input = this.constructor.pathData( file, source.root );
        this.output = this.constructor.pathData( path.resolve( target.root, this.input.rel ), target.root, append + ext );
        this._css = [];
        this._map = [];
        this.time = { total : null, rendered : null, processed : null, written : null };
        this.stats = { rendered : null, processed : null };
        this._errors = [];
    }

    static getLastOrNull( arr ) {
        if ( !( arr instanceof Array ) ) {
            throw Error( 'Argument must be an array' );
        }
        if ( arr.length ) {
            return arr[ arr.length - 1 ];
        }
        return null;
    }

    get css() {
        return this.constructor.getLastOrNull( this._css );
    }

    set css( value ) {
        this._css.push( value );
    }

    get map() {
        return this.constructor.getLastOrNull( this._map );
    }

    set map( value ) {
        this._map.push( value );
    }

    get errors() {
        return this._errors;
    }

    set errors( value ) {
        if ( value instanceof Array ) {
            this._errors = value;
        } else {
            this._errors.push( value );
        }
    }

    hasErrors() {
        return !!this._errors.length;
    }

    clearMemory() {
        this._css = [];
        this._map = [];
    }

    /**
     * @typedef {Object} ScssPathData
     * @property {string} root - Root directory path
     * @property {string} rel - Relative path
     * @property {string} dir - Directory path
     * @property {string} name - File name
     * @property {string} ext - File extension
     * @property {string} path - Absolute path
     */

    /**
     * Get path data
     * @public
     * @param {string} file - File path
     * @param {string} root - File root
     * @param {null|string} ext - File extension change
     * @return {Object|ScssPathData} - Path data
     */
    static pathData( file, root, ext = null ) {
        const data = {
            root : root,
            dir : path.dirname( file ),
            name : path.basename( file, path.extname( file ) ),
            ext : ext || path.extname( file ),
        };
        data.path = ext ? path.join( data.dir, data.name + data.ext ) : file;
        data.rel = '.' + path.sep + FsInterface.relative2root( data.path, root );
        return data;
    }
};
