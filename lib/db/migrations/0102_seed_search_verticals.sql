-- Seed starter search verticals for lead gen.
-- These target niche retainer prospects that broad sweep categories miss.
-- All Melbourne-centred with 50km radius unless the vertical is national/global.

INSERT OR IGNORE INTO search_verticals (id, name, category, location, location_lat, location_lng, radius_km, country_code, standing_brief, weight, is_active, search_count, created_at)
VALUES
  -- Retainer-track niches (high-value, established businesses)
  ('sv_caravan_outdoor', 'Caravan & Outdoor', 'caravan accessories and outdoor equipment', 'Melbourne, Australia', -37.8136, 144.9631, 100, 'AU', 'Established businesses in the caravan, camping, and outdoor recreation space. Looking for brands with existing products and customer base that need better content and digital presence.', 7, 1, 0, unixepoch() * 1000),

  ('sv_motorsport_recreation', 'Motorsport & Recreation', 'motorsport facilities and recreation services', 'Melbourne, Australia', -37.8136, 144.9631, 200, 'AU', 'Businesses in motorsport, track construction, racing events, or adventure recreation. Niche operators with strong word-of-mouth but underdeveloped digital marketing.', 6, 1, 0, unixepoch() * 1000),

  ('sv_specialty_construction', 'Specialty Construction', 'specialty construction and civil works', 'Melbourne, Australia', -37.8136, 144.9631, 100, 'AU', 'Specialty construction firms — pool builders, landscape architects, commercial fitouts, industrial construction. Businesses with $500k+ revenue that rely on reputation but underinvest in content.', 7, 1, 0, unixepoch() * 1000),

  ('sv_food_beverage_brands', 'Food & Beverage Brands', 'food and beverage manufacturers and brands', 'Melbourne, Australia', -37.8136, 144.9631, 100, 'AU', 'Product brands — breweries, distilleries, specialty food producers, supplement companies. Not cafes or restaurants. Businesses with a product to sell and a brand story to tell.', 6, 1, 0, unixepoch() * 1000),

  ('sv_health_clinics', 'Health & Wellness Clinics', 'allied health clinics and wellness centres', 'Melbourne, Australia', -37.8136, 144.9631, 50, 'AU', 'Multi-practitioner clinics — physio, chiro, osteo, psychology, skin clinics. Established practices with 3+ staff that compete locally but lack content differentiation.', 5, 1, 0, unixepoch() * 1000),

  ('sv_property_developers', 'Property & Development', 'property developers and boutique real estate', 'Melbourne, Australia', -37.8136, 144.9631, 75, 'AU', 'Boutique developers, project marketers, and premium real estate agencies. Businesses where visual storytelling directly drives revenue.', 6, 1, 0, unixepoch() * 1000),

  -- SaaS-track niches (broader geography, smaller businesses)
  ('sv_freelance_creative', 'Freelance Creatives', 'freelance photographers and videographers', 'Melbourne, Australia', -37.8136, 144.9631, 50, 'AU', 'Solo and small-team creative professionals — photographers, videographers, graphic designers. Price-sensitive but digitally savvy, natural SaaS-track fit.', 4, 1, 0, unixepoch() * 1000),

  ('sv_ecommerce_brands', 'Small E-commerce', 'small e-commerce brands and online stores', 'Australia', -25.2744, 133.7751, 5000, 'AU', 'Small online retailers and DTC brands. 1-10 person teams doing their own marketing, need tools more than services. SaaS-track prospects.', 5, 1, 0, unixepoch() * 1000);
