var pickle = require('chromium-pickle-js')
var fs = require('fs')
var thunky = require('thunky')
var path = require('path')

function asarReader(asarPath, options) {
	options = options || { }
	options.keepOpenFor = typeof(options.keepOpenFor) === "number" ? options.keepOpenFor : 1000

	var fdTimeout = null
	var fd = null
	var header = null
	var getFd = thunky(getFreshFd)
	var fdLocks = 0

	function getFreshFd(cb) {
		fs.open(asarPath, 'r', function(err, _fd) {
			// console.log('open fd')
			fd = _fd
			cb(err, _fd)
			renewFd()
		})
	}

	function renewFd() {
		clearTimeout(fdTimeout)
		fdTimeout = setTimeout(function() {
			fs.close(fd, function(err) {
				// console.log('closed fd')
				if (err) return // TODO FIXME XXX
				fd = null
				getFd = thunky(getFreshFd)
			})
		}, options.keepOpenFor)
	}

	function lockFd() {
		fdLocks++
		clearTimeout(fdTimeout)
	}

	function unlockFd() {
		fdLocks--
		if (fdLocks === 0) renewFd() // reset fd expire timeout
	}

	var readHeader = thunky(function(cb) {
		getFd(function(err) {
			if (err) return cb(err)
			lockFd()
			readHeaderFromFd(fd, function(err, header) {
				unlockFd()
				cb(err, header)
			})
		})
	})

	this.getHeader = function(cb) {
		readHeader(cb)
	}

	this.listFiles = function(cb) {
		readHeader(function(err, header) {
			if (err) return cb(err)

			var files = { }
			
			var fillFilesFromHeader = function(p, o) {
				var k, f, fullPath, results

				for (k in o.files) {
					f = o.files[k]
					fullPath = p+'/'+k
					if (f.files) fillFilesFromHeader(fullPath, f) // dir
					else files[fullPath] = f // file
				}
			};
			fillFilesFromHeader('', header.header);

			cb(null, files)
		})
	}

	// this API could be changed to locate path too, without passing fileObj directly
	this.readFile = function(fileObj, cb) {
		if (! (fileObj && fileObj.size)) return cb(new Error('file object must be passed'))

		getFd(function(err, fd) {
			if (err) return cb(err)

			readHeader(function(err, header) {
				if (err) return cb(err)

				var offset = 8 + header.headerSize + parseInt(fileObj.offset)
				var buf = new Buffer(fileObj.size)
				
				lockFd()
				fs.read(fd, buf, 0, fileObj.size, offset, function(err, bytesRead, buf) {
					unlockFd()

					if (err) return cb(err)
					cb(null, buf)
				})
			})
		})
	}

	/*
	// Does not work currently, offset is all wrong for some reason..
	// also we cannot lock the fd while this is happening
	this.getReadStream = function(fileObj, cb) {
		if (! (fileObj && fileObj.size)) return cb(new Error('file object must be passed'))

		getFd(function(err, fd) {
			if (err) return cb(err)
			
			readHeader(function(err, header) {
				if (err) return cb(err)

				var offset = 8 + header.headerSize + parseInt(fileObj.offset)
				cb(null, fs.createReadStream(null, { fd: fd, start: offset, end: offset+fileObj.size, autoClose: false }))
			})
		})
	}
	*/

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
			})
		})
	})
}

module.exports = asarReader;