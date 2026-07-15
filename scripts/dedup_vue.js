const fs = require("fs");
const file = "client/src/views/Admin.vue";
const lines = fs.readFileSync(file, "utf8").split("\n");

// Find the DUPLICATE block: the second occurrence of copyText (after formatDateTime)
const firstCopyText = lines.findIndex((l, i) => l.startsWith("const copyText") && i < 3940);
const secondCopyText = lines.findIndex((l, i) => l.startsWith("const copyText") && i > 3940);
console.log("firstCopyText line:", firstCopyText + 1);
console.log("secondCopyText line:", secondCopyText + 1);

// Find the end of the duplicate block: from secondCopyText, find where confirmDeleteApp ends
// It ends right before "const formatDateTimeSeconds"
const endMarker = lines.findIndex((l, i) => i > secondCopyText && l.startsWith("const formatDateTimeSeconds"));
console.log("endMarker line:", endMarker + 1);

// Remove lines from secondCopyText to endMarker (exclusive), i.e. indices [secondCopyText, endMarker)
// But keep one trailing blank line for spacing
const before = lines.slice(0, secondCopyText);
const after = lines.slice(endMarker);
const result = before.concat(after);
fs.writeFileSync(file, result.join("\n"), "utf8");
console.log("OK removed lines " + (secondCopyText+1) + "-" + endMarker + " new total=" + result.length);
