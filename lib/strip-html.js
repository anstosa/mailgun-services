const stripHtml = require('string-strip-html');

module.exports.default = (html) => stripHtml(html, {
    dumpLinkHrefsNearby: {
        enabled: true,
        wrapHeads: '(',
        wrapTails: ')'
    }
});
