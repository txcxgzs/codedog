const fs = require("fs");
const path = require("path");
const root = "C:/Users/Administrator/Desktop/codedog";
function apply(file, b64file){
  const b = fs.readFileSync(path.join(root, b64file), "utf8").trim();
  fs.writeFileSync(path.join(root, file), Buffer.from(b, "base64").toString("utf8"));
  console.log("applied", file);
}