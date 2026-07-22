-- 20260719160000_wave1_html_fallbacks.sql
-- Wave 1 PDF-heavy states (AZ, ID, NM, NV, UT) register their official regulation
-- PDFs, but the biggest ones (Arizona's 120-page master regs, the 6-8MB books)
-- exceed the edge function's time/CPU budget and time out (504/546) instead of
-- extracting. eRegulations mirrors each state's seasons as lightweight HTML that
-- the extractor strips to text in seconds — no PDF base64, no timeout. Register
-- these as parseable fallbacks so no state comes up empty.
--
-- NOTE: several of these eRegulations mirrors currently show the *prior* (2025-26)
-- season while the states' own PDFs carry 2026-27. That's intentional coverage —
-- proposals still land in the review queue, and you approve/skip per item in Admin.
-- Nevada's eReg mirror was already on 2026. All URLs verified live (July 2026).

insert into public.sources (agency_name, url, doc_type, state_id)
select v.agency, v.url, v.doc_type::source_doc_type, (select id from public.states where code = v.code)
from (values
  ('Arizona Game & Fish Department', 'https://www.eregulations.com/arizona/hunting/hunting-seasons-and-dates', 'webpage', 'AZ'),
  ('Idaho Department of Fish and Game', 'https://www.eregulations.com/idaho/hunting/hunting-seasons-and-dates', 'webpage', 'ID'),
  ('New Mexico Department of Game & Fish', 'https://www.eregulations.com/newmexico/hunting/hunting-seasons-and-dates', 'webpage', 'NM'),
  ('New Mexico Department of Game & Fish', 'https://www.eregulations.com/newmexico/hunting/migratory-birds-seasons-regulations', 'webpage', 'NM'),
  ('Nevada Department of Wildlife', 'https://www.eregulations.com/nevada/hunting/big-game/big-game-seasons', 'webpage', 'NV'),
  ('Utah Division of Wildlife Resources', 'https://www.eregulations.com/utah/hunting/hunting-seasons-and-dates', 'webpage', 'UT')
) as v(agency, url, doc_type, code)
where not exists (select 1 from public.sources s where s.url = v.url);
