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
const LEADS_FOLDER = 'C:\\Users\\vowmg\\OneDrive\\Desktop\\webleads';

const NICHES = [
  'auto detailing', 'barbershop', 'nail salon', 'landscaping',
  'cleaning service', 'tattoo shop', 'gym', 'plumber',
  'electrician', 'pressure washing',
  'roofing', 'construction', 'painting contractor', 'hvac',
  'fence company', 'concrete contractor', 'tree service',
  'carpet cleaning', 'moving company', 'pest control',
  'window cleaning', 'drywall contractor'
];

const CITIES = [
  { city: 'Houston', state: 'TX' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'Dallas', state: 'TX' },
  { city: 'Austin', state: 'TX' },
  { city: 'Fort Worth', state: 'TX' },
  { city: 'El Paso', state: 'TX' },
  { city: 'Corpus Christi', state: 'TX' },
  { city: 'Lubbock', state: 'TX' },
  { city: 'Laredo', state: 'TX' },
  { city: 'Victoria', state: 'TX' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Las Vegas', state: 'NV' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Miami', state: 'FL' },
  { city: 'Orlando', state: 'FL' },
  { city: 'Charlotte', state: 'NC' },
  { city: 'Nashville', state: 'TN' },
  { city: 'Denver', state: 'CO' },
  { city: 'Portland', state: 'OR' },
  { city: 'Memphis', state: 'TN' }
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
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
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
    return [];
  }
}

function saveCSV(leads, limit) {
  const date = new Date().toISOString().split('T')[0];
  const filename = path.join(LEADS_FOLDER, 'webleads_' + date + '_' + leads.length + 'leads.csv');
  const header = 'Business Name,Address,Phone,Rating,Reviews,Niche,City\n';
  const rows = leads.map(function(l) {
    return '"' + l.name + '","' + (l.address || '') + '","' + (l.phone || '') + '",' + (l.rating || '') + ',' + (l.reviews || '') + ',"' + l.niche + '","' + l.city + '"';
  }).join('\n');
  fs.writeFileSync(filename, header + rows);
  return filename;
}

app.get('/generate', async function(req, res) {
  const limit = parseInt(req.query.limit) || 50;
  const selectedNiches = req.query.niches ? req.query.niches.split(',') : ALL_NICHES;
  const seen = loadSeen();
  const leads = [];

  const combos = [];
  for (var i = 0; i < selectedNiches.length; i++) {
    for (var j = 0; j < CITIES.length; j++) {
      combos.push({ niche: selectedNiches[i], city: CITIES[j].city, state: CITIES[j].state });
    }
  }

  combos.sort(function() { return Math.random() - 0.5; });

  for (var k = 0; k < combos.length; k++) {
    if (leads.length >= limit) break;
    const combo = combos[k];
    const query = combo.niche + ' in ' + combo.city + ', ' + combo.state;
    const places = await searchPlaces(query);

    for (var m = 0; m < places.length; m++) {
      if (leads.length >= limit) break;
      const p = places[m];
      const phone = p.nationalPhoneNumber;
      if (!phone) continue;
      if (p.websiteUri) continue;
      if (!p.rating || p.rating < 4.5) continue;
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
        city: combo.city + ', ' + combo.state
      });
    }

    await new Promise(function(r) { setTimeout(r, 300); });
  }

  saveSeen(seen);
  const file = saveCSV(leads, limit);
  res.json({ count: leads.length, file: file, leads: leads });
});

app.get('/niches', function(req, res) {
  res.json({ niches: ALL_NICHES });
});

app.listen(3001, function() { console.log('Server running on http://localhost:3001'); });