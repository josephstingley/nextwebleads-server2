const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const GOOGLE_API_KEY = 'AIzaSyAbWvppyxVq48kvaXG0T1zkMk7NRYp6Swg';
const SEEN_FILE = path.join(__dirname, 'seen.json');

const ALL_NICHES = [
  'auto detailing', 'barbershop', 'nail salon', 'landscaping',
  'cleaning service', 'tattoo shop', 'gym', 'plumber',
  'electrician', 'pressure washing',
  'roofing', 'construction', 'painting contractor', 'hvac',
  'fence company', 'concrete contractor', 'tree service',
  'carpet cleaning', 'moving company', 'pest control',
  'window cleaning', 'drywall contractor'
];

const ALL_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
  'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
  'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
  'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const DEFAULT_STATES = [
  'Texas', 'Florida', 'Georgia', 'Nevada', 'Tennessee',
  'North Carolina', 'Colorado', 'Oregon'
];

function loadSeen() {
  try {
    if (fs.existsSync(SEEN_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(SEEN_FILE)));
    }
  } catch (e) {}
  return new Set();
}

function saveSeen(seen) {
  try {
    fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
  } catch (e) {}
}

async function searchPlaces(query) {
  try {
    const res = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      { textQuery: query, pageSize: 20 },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount'
        }
      }
    );
    return res.data.places || [];
  } catch (e) {
    console.error('Places API error:', e.message);
    return [];
  }
}

app.get('/generate', async function(req, res) {
  const limit = parseInt(req.query.limit) || 50;
  const isPro = req.query.pro === 'true';
  const selectedNiches = req.query.niches ? req.query.niches.split(',') : ALL_NICHES;
  const selectedStates = req.query.states ? req.query.states.split(',') : DEFAULT_STATES;
  const minRating = isPro ? 3.7 : 4.5;
  const seen = loadSeen();
  const leads = [];

  const combos = [];
  for (var i = 0; i < selectedNiches.length; i++) {
    for (var j = 0; j < selectedStates.length; j++) {
      combos.push({ niche: selectedNiches[i], state: selectedStates[j] });
    }
  }

  combos.sort(function() { return Math.random() - 0.5; });

  for (var k = 0; k < combos.length; k++) {
    if (leads.length >= limit) break;
    const combo = combos[k];
    const query = combo.niche + ' in ' + combo.state;
    const places = await searchPlaces(query);

    for (var m = 0; m < places.length; m++) {
      if (leads.length >= limit) break;
      const p = places[m];
      const phone = p.nationalPhoneNumber;
      if (!phone) continue;
      if (p.websiteUri) continue;
      if (!p.rating || p.rating < minRating) continue;
      if (!p.userRatingCount || p.userRatingCount < 5) continue;
      if (seen.has(phone)) continue;
      seen.add(phone);
      leads.push({
        name: p.displayName ? p.displayName.text : 'Unknown',
        address: p.formattedAddress || null,
        phone: phone,
        rating: p.rating,
        reviews: p.userRatingCount,
        niche: combo.niche,
        state: combo.state
      });
    }

    await new Promise(function(r) { setTimeout(r, 300); });
  }

  saveSeen(seen);
  res.json({ count: leads.length, leads: leads });
});

app.get('/niches', function(req, res) {
  res.json({ niches: ALL_NICHES });
});

app.get('/states', function(req, res) {
  res.json({ states: ALL_STATES });
});

app.get('/health', function(req, res) {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});