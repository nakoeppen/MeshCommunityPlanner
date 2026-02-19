# OpenStreetMap Tile Usage Policy - Compliance Documentation

**Date**: 2026-02-06
**Status**: ✅ COMPLIANT (Current Implementation)
**Risk Level**: ⚠️ CRITICAL - Must maintain compliance to avoid IP ban

---

## 🚨 CRITICAL WARNING

**OpenStreetMap Tile Usage Policy PROHIBITS**:
- ❌ Bulk downloading tiles
- ❌ Automated scraping/downloading beyond normal browsing
- ❌ Heavy usage without your own tile server
- ❌ Downloading tiles for offline use via automated tools

**Violation Results**:
- IP address permanently banned
- Service disruption for all users on same network
- Reputation damage

**Reference**: https://operations.osmfoundation.org/policies/tiles/

---

## ✅ Current W4 Implementation: COMPLIANT

### What We Actually Do

**Passive Caching Only**:
```typescript
// frontend/src/sw/tileServiceWorker.ts
// Tiles are ONLY cached when user views them during normal browsing
// NO bulk downloading, NO area pre-fetching, NO automated downloading

self.addEventListener('fetch', (event: FetchEvent) => {
  if (isTileRequest(event.request.url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);

        if (cachedResponse) {
          return cachedResponse; // Serve from cache
        }

        // Fetch from network (user-initiated only)
        const networkResponse = await fetch(event.request);

        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone()); // Cache for future
        }

        return networkResponse;
      })()
    );
  }
});
```

**How This Is Compliant**:
1. ✅ Tiles are only fetched when user pans/zooms to that area
2. ✅ No automated bulk downloading
3. ✅ Behaves like standard browser cache
4. ✅ Respects OSM's intended use (tile display during browsing)
5. ✅ Cache limit (50,000 tiles) prevents excessive storage

**Similar to**: Google Maps web app, Leaflet demos, standard web mapping

---

## ❌ What We DO NOT Do (Compliant)

**NOT Implemented** (Would violate policy):
- ❌ Bulk area download feature
- ❌ "Download for offline use" button
- ❌ Automated tile pre-fetching
- ❌ Background tile downloading
- ❌ Tile scraping tools
- ❌ MOBAC-style bulk downloaders

**Documentation Error**:
- Earlier documentation mentioned "bulk tile download" - **THIS WAS NEVER IMPLEMENTED**
- References to bulk download have been removed from documentation
- Only passive caching (compliant) is implemented

---

## ⚠️ Future Development: Safe Alternatives

If offline functionality beyond passive caching is needed, use these **COMPLIANT** alternatives:

### Option 1: Mapbox (Recommended for Production)

**Allows offline caching with proper licensing**:

```typescript
// frontend/src/components/map/MapContainer.tsx
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

L.tileLayer(
  `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
  {
    attribution: '© Mapbox © OpenStreetMap',
    tileSize: 512,
    zoomOffset: -1,
  }
).addTo(map);
```

**Pricing**:
- Free tier: 50,000 tile requests/month
- Paid: $5 per 1,000 requests beyond free tier

**License**: https://www.mapbox.com/legal/tos

---

### Option 2: Thunderforest

**Alternative commercial provider**:

```typescript
const THUNDERFOREST_KEY = import.meta.env.VITE_THUNDERFOREST_KEY;

L.tileLayer(
  `https://tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=${THUNDERFOREST_KEY}`,
  {
    attribution: '© Thunderforest © OpenStreetMap',
  }
).addTo(map);
```

**Pricing**:
- Free tier: 150,000 tile requests/month
- No offline restrictions with API key

---

### Option 3: Self-Hosted Tile Server

**Full control, no usage limits**:

1. Download OSM data: https://planet.openstreetmap.org/
2. Set up tile server:
   - PostgreSQL + PostGIS
   - Mapnik + mod_tile
   - OpenStreetMap Carto style
3. Configure frontend to use self-hosted tiles

**Resources**:
- Guide: https://switch2osm.org/serving-tiles/
- Docker setup: https://github.com/Overv/openstreetmap-tile-server

**Costs**:
- Storage: ~100GB for full planet, ~10GB for region
- Server: $20-50/month VPS
- Bandwidth: Variable

---

### Option 4: Commercial Regional Tiles

**Pre-rendered tile archives**:
- Some providers sell regional tile archives
- Legal for offline use
- No OSM server load

**Examples**:
- MapTiler (https://www.maptiler.com/)
- OpenMapTiles (https://openmaptiles.org/)

---

## 🔧 Configuration Options

### Current Default (OSM - Compliant)

```typescript
// .env.development
VITE_TILE_PROVIDER=osm
VITE_OSM_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

### Switch to Mapbox (Recommended)

```typescript
// .env.production
VITE_TILE_PROVIDER=mapbox
VITE_MAPBOX_TOKEN=pk.your_token_here
```

### Switch to Thunderforest

```typescript
// .env.production
VITE_TILE_PROVIDER=thunderforest
VITE_THUNDERFOREST_KEY=your_key_here
```

### Use Self-Hosted

```typescript
// .env.production
VITE_TILE_PROVIDER=custom
VITE_CUSTOM_TILE_URL=https://tiles.yourdomain.com/{z}/{x}/{y}.png
```

---

## 📊 Compliance Monitoring

### Usage Metrics to Track

Monitor these to ensure ongoing compliance:

1. **Tile Request Rate**:
   - Typical user: 50-200 tiles per session
   - Bulk download: 10,000+ tiles rapidly
   - **Alert if**: >1,000 tiles in <1 minute

2. **Cache Size**:
   - Normal usage: 500-5,000 tiles cached
   - Bulk download: 50,000+ tiles (max cache)
   - **Alert if**: Cache fills rapidly (>10,000 tiles/hour)

3. **Request Pattern**:
   - Normal: Clustered around viewport, user panning
   - Bulk: Sequential tile requests across large area
   - **Alert if**: Sequential pattern detected

---

## ✅ Compliance Checklist

Before any tile-related code changes:

- [ ] Does it fetch tiles beyond user's current viewport?
- [ ] Does it download tiles automatically without user interaction?
- [ ] Does it pre-fetch tiles for areas not yet viewed?
- [ ] Does it download tiles faster than normal browsing?
- [ ] Does it bypass standard browser caching?

**If YES to any**: ❌ **STOP - This violates OSM policy!**

---

## 🚀 Deployment Checklist

Before production deployment:

- [ ] Verify OSM tile usage is passive caching only
- [ ] Consider switching to Mapbox/Thunderforest for production
- [ ] Set up usage monitoring/alerts
- [ ] Document tile provider in deployment guide
- [ ] Add OSM attribution to map
- [ ] Test offline functionality (should work from cache only)
- [ ] Review tile request logs for bulk download patterns

---

## 📞 Support & Questions

**OSM Tile Usage Policy**: https://operations.osmfoundation.org/policies/tiles/

**Questions about tile usage?**
- OSM Operations Working Group: operations@osmfoundation.org
- Switch2OSM Guide: https://switch2osm.org/

**W4 Frontend Developer**: See `docs/W4_INTEGRATION_PLAN.md`

---

## 📝 Version History

| Date | Change | Reason |
|------|--------|--------|
| 2026-02-06 | Initial document created | User raised IP ban concerns |
| 2026-02-06 | Confirmed current implementation is compliant | Code review completed |
| 2026-02-06 | Removed "bulk download" from documentation | Feature was never implemented |
| 2026-02-06 | Added alternative tile provider options | Production readiness |

---

**Status**: ✅ Current implementation is COMPLIANT with OSM tile usage policy
**Recommendation**: Consider Mapbox for production deployment
**Risk**: LOW (as long as passive caching only)

---

**Last Updated**: 2026-02-06
**Next Review**: Before production deployment
