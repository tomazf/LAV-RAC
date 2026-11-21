-- Začetni podatki za šolsko bazo (majhen vzorec: Ana, Luka, Eva, Jan, Nika)
-- Zaženi PO sola_struktura.sql, v svoji shemi.
SET NAMES utf8mb4;

INSERT INTO kraj (id_kraj, postna_st, ime_kraja) VALUES
  (1, '8000', 'Novo mesto'),
  (2, '1000', 'Ljubljana'),
  (3, '4000', 'Kranj'),
  (4, '1230', 'Domžale');

INSERT INTO ucitelj (id_ucitelj, ime, priimek, email, datum_zaposlitve) VALUES
  (1,  'Mojca', 'Bregar', 'mojca.bregar@sc-nm.si', '2011-09-01'),
  (14, 'Miha',  'Novak',  'miha.novak@sc-nm.si',   '1997-02-01');

INSERT INTO predmet (id_predmet, kratica, ime_predmeta, podrocje, ur_tedensko) VALUES
  (1, 'MAT', 'Matematika',  'splošni', 4),
  (2, 'SLO', 'Slovenščina', 'splošni', 4),
  (3, 'ANG', 'Angleščina',  'splošni', 3);

INSERT INTO oddelek (id_oddelek, oznaka, letnik, id_razrednik) VALUES
  (7, '4A', 4, 14),
  (8, '4B', 4, 1);

INSERT INTO dijak (id_dijak, ime, priimek, spol, datum_rojstva, id_oddelek, id_kraj, email, telefon) VALUES
  (1, 'Ana',  'Novak',  'Ž', '2007-03-14', 7, 2, 'ana.novak1@dijak.sc-nm.si',  '031 322 300'),
  (2, 'Luka', 'Kovač',  'M', '2007-08-02', 8, 3, 'luka.kovac2@dijak.sc-nm.si', '070 279 235'),
  (3, 'Eva',  'Horvat', 'Ž', '2007-11-23', 7, 2, 'eva.horvat3@dijak.sc-nm.si', NULL),
  (4, 'Jan',  'Krajnc', 'M', '2008-01-09', 8, 4, 'jan.krajnc4@dijak.sc-nm.si', '040 735 828'),
  (5, 'Nika', 'Zupan',  'Ž', '2007-06-30', 8, 2, NULL,                         '070 479 482');

INSERT INTO poucuje (id_ucitelj, id_predmet, id_oddelek) VALUES
  (1, 1, 7), (1, 1, 8), (14, 2, 7), (14, 2, 8);

INSERT INTO ocena (id_dijak, id_predmet, id_ucitelj, ocena, vrsta, datum) VALUES
  (1, 1, 1, 4, 'pisna',  '2025-10-28'),
  (1, 2, 14, 5, 'ustna', '2025-11-12'),
  (2, 1, 1, 3, 'pisna',  '2025-10-28'),
  (3, 3, 14, 5, 'projekt','2025-12-05');

INSERT INTO izostanek (id_dijak, datum, ure, opravicen, opomba) VALUES
  (1, '2026-02-06', 6, 1, NULL),
  (1, '2026-02-09', 1, 1, 'prometna nesreča'),
  (4, '2026-03-02', 2, 0, NULL);
