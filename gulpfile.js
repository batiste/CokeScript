"use strict";

var gulp = require("gulp");
var browserify = require("browserify");
var source = require("vinyl-source-stream");
var uglify = require('gulp-uglify');
var streamify = require('gulp-streamify');
var stylish = require("jshint-stylish");
var jshint = require("gulp-jshint");

gulp.task("build", function() {
  return browserify("./cokescript.js", {
      debug: true,
      standalone: "cokescript"
    })
    .bundle()
    .pipe(source("cokescript.js"))
    .pipe(gulp.dest("./dist"));
});

gulp.task("jshint", function() {
  gulp.src("cokescript.js")
    .pipe(jshint())
    .pipe(jshint.reporter(stylish));
});

gulp.task("release", function() {
  return browserify("./cokescript.js", {
      debug: false,
      standalone: "cokescript"
    })
    .bundle()
    .pipe(source("cokescript.min.js"))
    .pipe(streamify(uglify()))
    .pipe(gulp.dest("./dist"));
});

gulp.task("default", function() {
  gulp.start("build");
});