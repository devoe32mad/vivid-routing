const fs = require("fs");
const path = require("path");

const target = process.env.VIVID_SERVER_FILE || path.join(__dirname, "server.js");
const patchText = "diff --git a/server.js b/server.js\nindex 9c6d37d..5d6290d 100644\n--- a/server.js\n+++ b/server.js\n@@ -86253,22 +86253,34 @@ const activeCampaigns =\n     =========================================================\n     */\n \n-    let advertisingInvestment = 0;\n+    const campaignAllocatedCosts = new Map(\n+      await Promise.all(\n+        campaignsResult.rows.map(\n+          async campaign => {\n+            const campaignId = Number(campaign.id);\n+            const allocatedCost =\n+              await allocatedSpotCostForCampaign(\n+                campaignId,\n+                startDate,\n+                endDate\n+              );\n \n-    for (\n-      const campaign\n-      of campaignsResult.rows\n-    ) {\n-      const allocatedCost =\n-        await allocatedSpotCostForCampaign(\n-          Number(campaign.id),\n-          startDate,\n-          endDate\n-        );\n+            return [\n+              campaignId,\n+              Number(allocatedCost || 0)\n+            ];\n+          }\n+        )\n+      )\n+    );\n \n-      advertisingInvestment +=\n-        Number(allocatedCost || 0);\n-    }\n+    const advertisingInvestment =\n+      [...campaignAllocatedCosts.values()]\n+        .reduce(\n+          (total, allocatedCost) =>\n+            total + allocatedCost,\n+          0\n+        );\n \n     /*\n     =========================================================\n@@ -86332,9 +86344,10 @@ CAMPAIGN PERFORMANCE\n =========================================================\n */\n \n-const campaignPerformance = [];\n-\n-for (const campaign of campaignsResult.rows) {\n+const campaignPerformance = (\n+  await Promise.all(\n+    campaignsResult.rows.map(\n+      async campaign => {\n \n   /*\n     Only current campaigns should compete for\n@@ -86342,7 +86355,7 @@ for (const campaign of campaignsResult.rows) {\n   */\n \n   if (campaign.is_archived) {\n-    continue;\n+    return null;\n   }\n \n   const values = [\n@@ -86420,15 +86433,10 @@ for (const campaign of campaignsResult.rows) {\n   const campaignRevenue =\n     Number(row.revenue || 0);\n \n-  const allocatedCost =\n-    await allocatedSpotCostForCampaign(\n-      Number(campaign.id),\n-      startDate,\n-      endDate\n-    );\n-\n   const campaignCost =\n-    Number(allocatedCost || 0);\n+    campaignAllocatedCosts.get(\n+      Number(campaign.id)\n+    ) || 0;\n \n   const campaignRoi =\n     campaignCost > 0\n@@ -86455,7 +86463,7 @@ for (const campaign of campaignsResult.rows) {\n         ) * 100\n       : 0;\n \n-  campaignPerformance.push({\n+  return {\n \n     id:\n       Number(campaign.id),\n@@ -86490,8 +86498,11 @@ for (const campaign of campaignsResult.rows) {\n     intentRate:\n       campaignIntentRate\n \n-  });\n-}\n+  };\n+      }\n+    )\n+  )\n+).filter(Boolean);\n \n \n /*\n@@ -86810,12 +86821,9 @@ const locationResult = await q(\n );\n \n \n-const locationPerformance = [];\n-\n-for (\n-  const location\n-  of locationResult.rows\n-) {\n+const locationPerformance = await Promise.all(\n+  locationResult.rows.map(\n+    async location => {\n \n   const values = [\n     Number(location.id)\n@@ -86917,21 +86925,21 @@ for (\n \n   let locationCost = 0;\n \n-  for (\n-    const qr\n-    of qrsResult.rows\n-  ) {\n-\n-    locationCost +=\n-      Number(\n-        await allocatedSpotCostForQr(\n-          Number(qr.id),\n-          startDate,\n-          endDate\n-        ) || 0\n-      );\n+  const qrAllocatedCosts = await Promise.all(\n+    qrsResult.rows.map(\n+      qr => allocatedSpotCostForQr(\n+        Number(qr.id),\n+        startDate,\n+        endDate\n+      )\n+    )\n+  );\n \n-  }\n+  locationCost = qrAllocatedCosts.reduce(\n+    (total, allocatedCost) =>\n+      total + Number(allocatedCost || 0),\n+    0\n+  );\n \n \n   const locationRoi =\n@@ -86946,7 +86954,7 @@ for (\n       : 0;\n \n \n-  locationPerformance.push({\n+  return {\n \n     id:\n       Number(location.id),\n@@ -86975,9 +86983,10 @@ for (\n     roi:\n       locationRoi\n \n-  });\n-\n-}\n+  };\n+    }\n+  )\n+);\n \n \n const rankedLocations =\n@@ -87119,13 +87128,9 @@ const placementResult = await q(\n );\n \n \n-const placementPerformance = [];\n-\n-\n-for (\n-  const placement\n-  of placementResult.rows\n-) {\n+const placementPerformance = await Promise.all(\n+  placementResult.rows.map(\n+    async placement => {\n \n   const values = [\n     Number(placement.id)\n@@ -87239,7 +87244,7 @@ for (\n       : 0;\n \n \n-  placementPerformance.push({\n+  return {\n \n     id:\n       Number(placement.id),\n@@ -87271,9 +87276,10 @@ for (\n     roi:\n       placementRoi\n \n-  });\n-\n-}\n+  };\n+    }\n+  )\n+);\n \n \n /*\n";

function applyUnifiedPatch(source, patch) {
  const lines = patch.split("\n");
  const hunks = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].startsWith("@@")) {
      index += 1;
      continue;
    }

    index += 1;
    const before = [];
    const after = [];

    while (
      index < lines.length &&
      !lines[index].startsWith("@@") &&
      !lines[index].startsWith("diff --git ")
    ) {
      const line = lines[index];
      const marker = line[0];
      const content = line.slice(1);

      if (marker === " " || marker === "-") before.push(content);
      if (marker === " " || marker === "+") after.push(content);
      index += 1;
    }

    hunks.push({
      before: before.join("\n"),
      after: after.join("\n")
    });
  }

  let output = source;

  for (const hunk of hunks) {
    const matches = output.split(hunk.before).length - 1;
    if (matches !== 1) {
      throw new Error(
        "AI insights performance patch expected one source match; found " +
        matches
      );
    }
    output = output.replace(hunk.before, hunk.after);
  }

  return output;
}

const source = fs.readFileSync(target, "utf8");

if (source.includes("const campaignAllocatedCosts = new Map(")) {
  console.log("AI insights performance optimization already installed.");
  process.exit(0);
}

const updated = applyUnifiedPatch(source, patchText);
fs.writeFileSync(target, updated);
console.log("AI insights performance optimization installed.");

