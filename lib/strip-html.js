const stripHtml = require('string-strip-html');

module.exports.stripHtml = (html) => stripHtml(html, {
    dumpLinkHrefsNearby: {
        enabled: true,
        wrapHeads: '(',
        wrapTails: ')'
    }
});
