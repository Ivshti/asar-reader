var pickle = require('chromium-pickle-js')
var fs = require('fs')
var thunky = require('thunky')
var path = require('path')

function asarReader(asarPath, options) {
	options = options || { }
	options.keepOpenFor = typeof(options.keepOpenFor) === "number" ? options.keepOpenFor : 500

	var fdTimeout = null
	var fd = null
	var header = null
	var getFd = thunky(getFreshFd)

	function getFreshFd(cb) {
		fs.open(asarPath, 'r', function(err, _fd) {
			fd = _fd
			cb(err, _fd)
			renewFd()
			console.log('open fd')
		})
	}

	function renewFd() {
		if (fdTimeout) clearTimeout(fdTimeout)
		fdTimeout = setTimeout(function() {
			fs.close(fd, function(err) {
				if (err) return
				fd = null
				getFd = thunky(getFreshFd)

				console.log('closed fd')
			})
		}, options.keepOpenFor)
	}

	var readHeader = thunky(function(cb) {
		getFd(function(err) {
			if (err) return cb(err)
			readHeaderFromFd(fd, cb)
		})
	})

	this.listFiles = function(cb) {
		readHeader(function(err, header) {
			if (err) return cb(err)

			var files = []
			
			var fillFilesFromHeader = function(p, o) {
				var f, fullPath, results;
				if (!o.files) return;

				results = [];
				for (f in o.files) {
					fullPath = p+'/'+f;
					files.push(fullPath);
					results.push(fillFilesFromHeader(fullPath, o.files[f]));
				}
				return results;
			};
			fillFilesFromHeader('', header.header);

			cb(null, files)
		})
	}

	this.readFile = function() {

	}

	return this
}

function readHeaderFromFd(fd, cb) {
	var sizeBuf = new Buffer(8);
	fs.read(fd, sizeBuf, 0, 8, null, function(err, bytesRead, buf) {
		if (err) return cb(err)
		if (bytesRead !== 8) return cb(Error('Unable to read header size'))

		var sizePickle = pickle.createFromBuffer(sizeBuf)
		var size = sizePickle.createIterator().readUInt32()
		var headerBuf = new Buffer(size)

		fs.read(fd, headerBuf, 0, size, null, function(err, bytesRead, buf) {
			if (err) return cb(err)
			if (bytesRead !== size) return cb(new Error('Unable to read header'))

			var headerPickle = pickle.createFromBuffer(headerBuf)
			var header = headerPickle.createIterator().readString()

			try { header = JSON.parse(header) } catch(e) { return cb(err) }
			
			cb(null, {
				header: header,
				headerSize: size
			});
		})
	})
}

var reader = asarReader('/Users/ivogeorgiev/stremio/dist/final/stremio.asar')
reader.listFiles(function(err, files) {
	console.log(files)
})

module.exports = asarReader;