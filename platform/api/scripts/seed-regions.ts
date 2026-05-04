/**
 * Seeds the Firestore `regions` collection with Cloud Run regions for the
 * 3D Earth globe (Phase 3). Idempotent — safe to re-run.
 *
 * Usage (with ADC authenticated to adkclaw-prod):
 *   GOOGLE_CLOUD_PROJECT=adkclaw-prod npx tsx scripts/seed-regions.ts
 */

import { Firestore } from '@google-cloud/firestore';

interface Region {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cloudProvider: 'gcp';
}

const CLOUD_RUN_REGIONS: Region[] = [
  // Americas
  { id: 'us-central1', name: 'Iowa, USA', lat: 41.59, lng: -93.62, cloudProvider: 'gcp' },
  { id: 'us-east1', name: 'South Carolina, USA', lat: 33.84, lng: -81.16, cloudProvider: 'gcp' },
  { id: 'us-east4', name: 'Northern Virginia, USA', lat: 39.04, lng: -77.49, cloudProvider: 'gcp' },
  { id: 'us-east5', name: 'Columbus, Ohio, USA', lat: 39.96, lng: -82.99, cloudProvider: 'gcp' },
  { id: 'us-south1', name: 'Dallas, Texas, USA', lat: 32.78, lng: -96.8, cloudProvider: 'gcp' },
  { id: 'us-west1', name: 'Oregon, USA', lat: 45.59, lng: -121.18, cloudProvider: 'gcp' },
  { id: 'us-west2', name: 'Los Angeles, USA', lat: 34.05, lng: -118.24, cloudProvider: 'gcp' },
  { id: 'us-west3', name: 'Salt Lake City, USA', lat: 40.76, lng: -111.89, cloudProvider: 'gcp' },
  { id: 'us-west4', name: 'Las Vegas, USA', lat: 36.17, lng: -115.14, cloudProvider: 'gcp' },
  {
    id: 'northamerica-northeast1',
    name: 'Montréal, Canada',
    lat: 45.5,
    lng: -73.57,
    cloudProvider: 'gcp',
  },
  {
    id: 'northamerica-northeast2',
    name: 'Toronto, Canada',
    lat: 43.65,
    lng: -79.38,
    cloudProvider: 'gcp',
  },
  {
    id: 'southamerica-east1',
    name: 'São Paulo, Brazil',
    lat: -23.55,
    lng: -46.63,
    cloudProvider: 'gcp',
  },
  {
    id: 'southamerica-west1',
    name: 'Santiago, Chile',
    lat: -33.45,
    lng: -70.67,
    cloudProvider: 'gcp',
  },

  // Europe
  {
    id: 'europe-west1',
    name: 'St. Ghislain, Belgium',
    lat: 50.45,
    lng: 3.82,
    cloudProvider: 'gcp',
  },
  { id: 'europe-west2', name: 'London, UK', lat: 51.51, lng: -0.13, cloudProvider: 'gcp' },
  { id: 'europe-west3', name: 'Frankfurt, Germany', lat: 50.11, lng: 8.68, cloudProvider: 'gcp' },
  {
    id: 'europe-west4',
    name: 'Eemshaven, Netherlands',
    lat: 53.43,
    lng: 6.83,
    cloudProvider: 'gcp',
  },
  { id: 'europe-west6', name: 'Zürich, Switzerland', lat: 47.38, lng: 8.54, cloudProvider: 'gcp' },
  { id: 'europe-west8', name: 'Milan, Italy', lat: 45.46, lng: 9.19, cloudProvider: 'gcp' },
  { id: 'europe-west9', name: 'Paris, France', lat: 48.86, lng: 2.35, cloudProvider: 'gcp' },
  { id: 'europe-west10', name: 'Berlin, Germany', lat: 52.52, lng: 13.4, cloudProvider: 'gcp' },
  { id: 'europe-west12', name: 'Turin, Italy', lat: 45.07, lng: 7.69, cloudProvider: 'gcp' },
  { id: 'europe-north1', name: 'Hamina, Finland', lat: 60.57, lng: 27.19, cloudProvider: 'gcp' },
  { id: 'europe-southwest1', name: 'Madrid, Spain', lat: 40.42, lng: -3.7, cloudProvider: 'gcp' },
  { id: 'europe-central2', name: 'Warsaw, Poland', lat: 52.23, lng: 21.01, cloudProvider: 'gcp' },

  // Asia
  { id: 'asia-east1', name: 'Changhua, Taiwan', lat: 24.07, lng: 120.54, cloudProvider: 'gcp' },
  { id: 'asia-east2', name: 'Hong Kong', lat: 22.32, lng: 114.17, cloudProvider: 'gcp' },
  { id: 'asia-northeast1', name: 'Tokyo, Japan', lat: 35.68, lng: 139.69, cloudProvider: 'gcp' },
  { id: 'asia-northeast2', name: 'Osaka, Japan', lat: 34.69, lng: 135.5, cloudProvider: 'gcp' },
  {
    id: 'asia-northeast3',
    name: 'Seoul, South Korea',
    lat: 37.57,
    lng: 126.98,
    cloudProvider: 'gcp',
  },
  { id: 'asia-south1', name: 'Mumbai, India', lat: 19.08, lng: 72.88, cloudProvider: 'gcp' },
  { id: 'asia-south2', name: 'Delhi, India', lat: 28.7, lng: 77.1, cloudProvider: 'gcp' },
  { id: 'asia-southeast1', name: 'Singapore', lat: 1.35, lng: 103.82, cloudProvider: 'gcp' },
  {
    id: 'asia-southeast2',
    name: 'Jakarta, Indonesia',
    lat: -6.21,
    lng: 106.85,
    cloudProvider: 'gcp',
  },

  // Middle East
  { id: 'me-central1', name: 'Doha, Qatar', lat: 25.29, lng: 51.53, cloudProvider: 'gcp' },
  { id: 'me-central2', name: 'Dammam, Saudi Arabia', lat: 26.39, lng: 49.97, cloudProvider: 'gcp' },
  { id: 'me-west1', name: 'Tel Aviv, Israel', lat: 32.08, lng: 34.78, cloudProvider: 'gcp' },

  // Africa
  {
    id: 'africa-south1',
    name: 'Johannesburg, South Africa',
    lat: -26.2,
    lng: 28.05,
    cloudProvider: 'gcp',
  },

  // Australia
  {
    id: 'australia-southeast1',
    name: 'Sydney, Australia',
    lat: -33.87,
    lng: 151.21,
    cloudProvider: 'gcp',
  },
  {
    id: 'australia-southeast2',
    name: 'Melbourne, Australia',
    lat: -37.81,
    lng: 144.96,
    cloudProvider: 'gcp',
  },
];

async function main() {
  const projectId = process.env['GOOGLE_CLOUD_PROJECT'] || 'adkclaw-prod';
  const fs = new Firestore({ projectId, ignoreUndefinedProperties: true });
  const collection = fs.collection('regions');

  console.log(`Seeding ${CLOUD_RUN_REGIONS.length} regions into ${projectId}/regions...`);

  let written = 0;
  // Firestore batch limit = 500. We have ~38 regions, so one batch is fine.
  const batch = fs.batch();
  for (const region of CLOUD_RUN_REGIONS) {
    batch.set(collection.doc(region.id), region);
    written += 1;
  }
  await batch.commit();

  console.log(`✓ Seeded ${written} regions.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
