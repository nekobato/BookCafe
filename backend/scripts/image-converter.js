const fs = require('fs-extra')
const path = require('path')
const { spawn } = require('child_process')
const _ = require('lodash')
const { Book } = require('../models')
const config = require('../config')

// src + dbは既に存在する前提

module.exports = {
  async init () {

    let books = await Book.find({ converted_at: { $eq: null } })

    for (let book of books) {
      console.log(`Convert: ${book.title}`)

      let bookSrcDir = path.join(config.dir.src, book.uuid)

      if (! await fs.pathExists) {
        console.log(`${book.title} - ${book.uuid} does not exist as Directory.`)
        Book.deleteOne({ uuid: book.uuid })
        console.log(`removed ${book.uuid} from DB`)
        continue
      }

      let images = _.filter(fs.readdirSync(bookSrcDir), n => {
        return /\.(jpe?g|png)$/.test(n)
      })

      // Check Source Directory Images Existence
      if (images.length === 0) {
        console.log('no images found in: ${book.title} (${book.uuid})')
        Book.remove({ uuid: book.uuid })
        fs.rmdirSync(path.join(config.dir.src, book.uuid))
        continue
      }

      await createThumbnail(book, images[0])

      await fs.ensureDir(path.join(config.dir.small, book.uuid))
      await fs.ensureDir(path.join(config.dir.big, book.uuid))

      for (let image of images) {
        await createSmallImage(book, image)
        await createBigImage(book, image)
      }

      await Book.converted(book)
    }

    return true
  }
}

function createThumbnail (book, image) {
  return writeImage(
    path.join(config.dir.src, book.uuid, image), // read
    path.join(config.dir.thumbnail, book.uuid + '.jpg'), // write
    config.size.thumbnail, // size
    50) // quality
}

function createSmallImage (book, image) {
  return writeImage(
    path.join(config.dir.src, book.uuid, image), // read
    path.join(config.dir.small, book.uuid, image), // write
    config.size.small, // size
    90) // quality
}

function createBigImage (book, image) {
  return writeImage(
    path.join(config.dir.src, book.uuid, image), // read
    path.join(config.dir.big, book.uuid, image), // write
    config.size.big, // size
    90) // quality
}

function writeImage (readFile, writeFile, size, quality) {
  let convert = spawn('convert', [readFile, '-resize', `${size.width}x${size.height}`, '-quality', quality, writeFile])

  convert.stdout.on('data', data => {
    return Promise.resolve(data)
  })

  convert.stderr.on('data', err => {
    return Promise.reject(err)
  })

  convert.on('close', code => {
    if (code === 1) return Promise.reject('convert command exited with code 1.')
  })
}
