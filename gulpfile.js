'use strict';

const { src, dest, watch, series, parallel } = require('gulp');
const sass = require('gulp-sass');
const cheerio = require('gulp-cheerio');
const autoprefixer = require('autoprefixer');
const postcss = require('gulp-postcss');
const flatten = require('gulp-flatten');
const rename = require('gulp-rename');
const del = require('del');
const csso = require('gulp-csso');
const concat = require('gulp-concat');
const uglify = require('gulp-uglify');
const imagemin = require('gulp-imagemin');
const mozjpeg = require('imagemin-mozjpeg');
const gulpwebp = require('gulp-webp');
const svgmin = require('gulp-svgmin');
const svgstore = require('gulp-svgstore');
const server = require('browser-sync').create();
const plumber = require('gulp-plumber');
const critical = require('critical').stream;
const log = require('fancy-log');
// const terser = require('gulp-terser');
// const babel = require('gulp-babel');

sass.compiler = require('node-sass');

// CLEAR BUILD FOLDER

const clearBuild = () => {
  return del('build');
};

// CLEAR FAVICON FOLDER

const clearFavicon = () => {
  return del('build/img/favicon');
};

// COPYING ASSETS

const copyAssets = () => {
  return src([
    'source/fonts/**/*',
    'source/img/**/*'
    // 'source/.htaccess'
  ],
  {
    base: 'source'
  })
    .pipe(dest('build/'));
};

// COPYING FAVICONS

const favicon = () => {
  return src('source/img/favicon/*')
    .pipe(dest('build/'));
};

// COPYING HTML

const html = () => {
  return src('source/*.html')
    .pipe(dest('build/'));
};

// CONCATENATION, UGLIFYING AND COPYING OF SCRIPTS

const scripts = () => {
  return src('source/js/*.js')
    .pipe(plumber())
    // .pipe(babel())
    .pipe(concat('main.min.js'))
    .pipe(uglify())
    .pipe(dest('build/js/'));
};

// COPYING VENDOR FILES THAT CANNOT BE CONCATENATED WITH OTHERS

const vendorCopy = () => {
  return src([
    'node_modules/picturefill/dist/picturefill.min.js'
    // 'node_modules/swiper/css/swiper.min.css'
  ])
    .pipe(flatten())
    .pipe(dest('build/vendor/'));
};

// CONCATENATION AND COPYING OF VENDOR FILES

const vendorBundle = () => {
  return src([
    'node_modules/jquery/dist/jquery.min.js',
    'node_modules/object-fit-images/dist/ofi.min.js',
    'node_modules/loading-attribute-polyfill/loading-attribute-polyfill.min.js'
    // 'node_modules/swiper/js/swiper.min.js'
  ])
    .pipe(concat('vendor.min.js'))
    .pipe(dest('build/vendor/'));
};

// COMPILING, MINIFICATION AND COPYING STYLES

const styles = () => {
  return src('source/sass/main.scss')
    .pipe(sass.sync({ outputStyle: 'expanded' }).on('error', sass.logError))
    .pipe(postcss([autoprefixer()]))
    .pipe(dest('build/css/'))
    .pipe(csso({
      // restructure: false
    }))
    .pipe(rename('main.min.css'))
    .pipe(dest('build/css/'))
    .pipe(server.stream());
};

// GENERATE & INLINE CRITICAL-PATHS CSS

const criticalCss = () => {
  return src('build/index.html')
    .pipe(
      critical({
        base: 'build/',
        inline: true,
        minify: true,
        // width: 1300,
        // height: 900,
        // dimensions: [{
        //   height: 200,
        //   width: 500
        // }, {
        //   height: 900,
        //   width: 1200
        // }],
        css: [
          'build/css/main.css'
        ]
      })
    )
    .on('error', function (err) {
      log.error(err.message);
    })
    .pipe(dest('build'));
};

// PICTURE OPTIMIZATION

const images = () => {
  return src('source/img/*.{jpg,png,gif}')
    .pipe(
      imagemin([
        imagemin.gifsicle({ interlaced: true }),
        mozjpeg({ quality: 80, progressive: true }),
        imagemin.optipng({ optimizationLevel: 5 })
      ])
    )
    .pipe(dest('source/img/'));
};

// WEBP CONVERTING PICTURES
// https://github.com/imagemin/imagemin-webp#imageminwebpoptions
// Crop - Object { x: number, y: number, width: number,
// height: number }
// Resize the image. Happens after crop - Object { width: number, height:
// number }

const webp = () => {
  return src('source/img/*.{jpg,png}')
    .pipe(gulpwebp({ quality: 85 }))
    .pipe(dest('source/img/webp'));
};

// SVG OPTIMIZATION

const svg = () => {
  return src('source/img/svg/**/*.svg')
    .pipe(
      svgmin({
        plugins: [
          {
            removeTitle: true
          },
          {
            removeDesc: true
          },
          {
            removeViewBox: false
          },
          {
            removeDimensions: true
          },
          {
            sortAttrs: true
          },
          {
            cleanupNumericValues: {
              floatPrecision: 0,
              leadingZero: true,
              defaultPx: true,
              convertToPx: true
            }
          }
        ],
        js2svg: {
          pretty: true
        }
      })
    )
    .pipe(
      cheerio({
        run: function ($) {
        // $('[fill]').removeAttr('fill');
        },
        parserOptions: { xmlMode: true }
      })
    )
    .pipe(dest('source/img/svg'));
};

// CREATING SVG-SPRITE

const svgSprite = () => {
  return src('source/img/svg/sprite/*.svg')
    .pipe(
      svgmin({
        plugins: [
          {
            removeTitle: true
          },
          {
            removeDesc: true
          },
          {
            removeViewBox: false
          },
          {
            removeDimensions: true
          },
          {
            sortAttrs: true
          },
          {
            cleanupNumericValues: {
              floatPrecision: 0,
              leadingZero: true,
              defaultPx: true,
              convertToPx: true
            }
          }
        ],
        js2svg: {
          pretty: true
        }
      })
    )
    .pipe(
      cheerio({
        run: function ($) {
        // $('[fill]').removeAttr('fill');
        },
        parserOptions: { xmlMode: true }
      })
    )
    .pipe(svgstore({ inlineSvg: true }))
    .pipe(
      cheerio({
        run: function ($) {
          $('svg').attr('class', 'visuallyhidden');
        },
        parserOptions: { xmlMode: true }
      })
    )
    .pipe(rename('sprite.svg'))
    .pipe(dest('source/img/svg/sprite/'));
};

// BROWSER PAGE UPDATE

const reload = (done) => {
  server.reload();
  done();
};

// FILES CHANGE TRACKING

const serve = (cb) => {
  server.init({
    server: './build',
    startPath: 'index.html',
    cors: true,
    notify: false
  });

  watch('source/js/*.js', series(scripts, reload));
  watch('source/sass/**/*.scss', series(styles));
  watch('source/*.html', { events: ['change'] }, series(html, reload));
  cb();
};

// AVAILABLE TASKS

// clear build folder
exports.clearBuild = clearBuild;

// clear favicon folder
exports.clearFavicon = clearFavicon;

// copying assets
exports.copyAssets = copyAssets;

// copying favicons
exports.favicon = favicon;

// copying html
exports.html = html;

// concatenation, uglifying & copying of scripts
exports.scripts = scripts;

// copying vendor files that cannot be concatenated with others
exports.vendorCopy = vendorCopy;

// concatenation & copying of vendor files
exports.vendorBundle = vendorBundle;

// compiling, minification & copying styles
exports.styles = styles;

// generate & inline critical-paths css
exports.criticalCss = criticalCss;

// image optimization
exports.images = images;

// convert pictures to webp format
exports.webp = webp;

// svg optimization
exports.svg = svg;

// create svg sprite
exports.svgSprite = svgSprite;

// browser page update
exports.reload = reload;

// files change tracking
exports.serve = serve;

// start of development
exports.default = series(clearBuild, parallel(copyAssets, vendorCopy, vendorBundle, html, styles, scripts), serve);

// final assembly of the project
exports.build = series(clearBuild, parallel(copyAssets, favicon, vendorCopy, vendorBundle, html, styles, scripts), clearFavicon);
