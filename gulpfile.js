const gulp = require('gulp');
const less = require('gulp-less');
const yaml = require('gulp-yaml');

/* ----------------------------------------- */
/*  Compile LESS
/* ----------------------------------------- */

const ZW_LESS = ["less/*.less"];
function compileLESS() {
    return gulp.src("less/wa.less")
        .pipe(less())
        .pipe(gulp.dest("./"))
}
const css = gulp.series(compileLESS);

/* ----------------------------------------- */
/*  Compile YAML
/* ----------------------------------------- */

const SYSTEM_YAML = ['./yaml/**/*.yml', './yaml/**/*.yaml'];

function compileYaml() {
    return gulp.src(SYSTEM_YAML)
        .pipe(yaml({space: 2}))
        .pipe(gulp.dest('./'))
}

const yamlTask = gulp.series(compileYaml);

/* ----------------------------------------- */

/*  Watch Updates
/* ----------------------------------------- */

function watchUpdates() {
    gulp.watch(ZW_LESS, css);
    gulp.watch(SYSTEM_YAML, yamlTask);
}

/* ----------------------------------------- */
/*  Export Tasks
/* ----------------------------------------- */

exports.default = gulp.series(
    compileYaml,
    gulp.parallel(css),
    watchUpdates
);
exports.css = css;
exports.yaml = yamlTask;