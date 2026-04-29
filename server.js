const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let events = [];

const placements = {
  school1: {
    name: "Gulf Coast HS Car Line",
    cost: 800,
    advertisers: [
      {
        name: "Dunkin",
        weight: 70,
        campaignCost: 500,
        avgCustomerValue: 50,
        campaigns: [
          {
            name: "Morning Coffee Offer",
            offerUrl: "https://www.dunkindonuts.com",
            stores: [
              {
                name: "Dunkin - Pine Ridge",
                weight: 70,
                inventory: "high",
                mapsUrl:
                  "https://www.google.com/maps/search/?api=1&query=Dunkin+Pine+Ridge+Naples+FL",
                wazeUrl:
                  "https://waze.com/ul?q=Dunkin%20Pine%20Ridge%20Naples%20FL&navigate=yes",
              },
              {
                name: "Dunkin - Immokalee",
                weight: 30,
                inventory: "normal",
                mapsUrl:
                  "https://www.google.com/maps/search/?api=1&query=Dunkin+Immokalee+Naples+FL",
                wazeUrl:
                  "https://waze.com/ul?q=Dunkin%20Immokalee%20Naples%20FL&navigate=yes",
              },
            ],
          },
        ],
      },
      {
        name: "Chick-fil-A",
        weight: 30,
        campaignCost: 300,
        avgCustomerValue: 40,
        campaigns: [
          {
            name: "Lunch Family Meal",
            offerUrl: "https://www.chick-fil-a.com",
            stores: [
              {
                name: "Chick-fil-A - Naples",
                weight: 100,
                inventory: "normal",
                mapsUrl:
                  "https://www.google.com/maps/search/?api=1&query=Chick-fil-A+Naples+FL",
                wazeUrl:
                  "https://waze.com/ul?q=Chick-fil-A%20Naples%20FL&navigate=yes",
              },
            ],
          },
        ],
      },
    ],
  },
};
app.get("/r/:placementId", (req, res) => {
  try {
    const placementId = req.params.placementId;
    const placement = placements[placementId];

    if (!placement) {
      return res.status(404).send("Placement not found");
    }

    const advertiser = pickWeighted(placement.advertisers);
    const campaign = advertiser.campaigns[0];
    const store = pickWeighted(campaign.stores);

    events.push({
      type: "scan",
      placementId,
      placementName: placement.name,
      advertiser: advertiser.name,
      campaign: campaign.name,
      store: store.name,
      time: new Date().toLocaleString(),
    });

    res.send(`
      <h1>${advertiser.name}</h1>
      <p>${campaign.name}</p>
      <p>${store.name}</p>

      <a href="/go/maps/${placementId}/${advertiser.name}/${campaign.name}/${store.name}">Google Maps</a><br/>
      <a href="/go/waze/${placementId}/${advertiser.name}/${campaign.name}/${store.name}">Waze</a><br/>
      <a href="/go/offer/${placementId}/${advertiser.name}/${campaign.name}/${store.name}">Offer</a>
    `);

  } catch (err) {
    console.error("ROUTING ERROR:", err);
    res.status(500).send("Routing failed");
  }
});
