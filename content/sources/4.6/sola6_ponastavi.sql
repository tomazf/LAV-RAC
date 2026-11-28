-- ============================================================
-- Šolska baza SOLA · LAV-RAČ4 · poglavje 6 (SQL DML) · izhodišče (K0)
-- Stanje po poglavju 4: struktura in začetni podatki (5 dijakov, 2 učitelja, 4 ocene).
-- Zaženi jo na začetku poglavja 6, če preverjanje izhodišča ne da pričakovanih števil.
-- MySQL 8.4 · utf8mb4 · slovenska collation.
-- Skripta najprej izbriše tabele z istimi imeni v izbrani shemi (tudi tiste, ki si jih naredil sam).
-- Uporaba: v MySQL Workbench dvoklikni SVOJO shemo (postane krepka), odpri skripto in jo zaženi (strela).
-- ============================================================
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS t_arhiv_ocena, t_tekmovanje, t_izpisani_dijak, t_stara_ocena, t_uvoz_izostanek;
SET FOREIGN_KEY_CHECKS = 1;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS izostanek, ocena, poucuje, dijak, predmet, oddelek, ucitelj, kraj;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE kraj (
  id_kraj     INT          NOT NULL,
  postna_st   CHAR(4)      NOT NULL,
  ime_kraja   VARCHAR(30)  NOT NULL,
  PRIMARY KEY (id_kraj),
  UNIQUE (postna_st)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;

CREATE TABLE ucitelj (
  id_ucitelj        INT          NOT NULL,
  ime               VARCHAR(20)  NOT NULL,
  priimek           VARCHAR(30)  NOT NULL,
  email             VARCHAR(50)  NULL,
  datum_zaposlitve  DATE         NOT NULL,
  PRIMARY KEY (id_ucitelj),
  UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;

CREATE TABLE predmet (
  id_predmet    INT          NOT NULL,
  kratica       VARCHAR(5)   NOT NULL,
  ime_predmeta  VARCHAR(40)  NOT NULL,
  podrocje      VARCHAR(20)  NOT NULL,
  ur_tedensko   TINYINT      NOT NULL,
  PRIMARY KEY (id_predmet),
  UNIQUE (kratica)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;

CREATE TABLE oddelek (
  id_oddelek    INT      NOT NULL,
  oznaka        CHAR(2)  NOT NULL,
  letnik        TINYINT  NOT NULL,
  id_razrednik  INT      NULL,
  PRIMARY KEY (id_oddelek),
  UNIQUE (oznaka),
  CONSTRAINT ck_oddelek_letnik CHECK (letnik BETWEEN 1 AND 4),
  CONSTRAINT fk_oddelek_razrednik FOREIGN KEY (id_razrednik) REFERENCES ucitelj (id_ucitelj)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;

CREATE TABLE dijak (
  id_dijak       INT          NOT NULL,
  ime            VARCHAR(20)  NOT NULL,
  priimek        VARCHAR(30)  NOT NULL,
  spol           CHAR(1)      NOT NULL,
  datum_rojstva  DATE         NOT NULL,
  id_oddelek     INT          NOT NULL,
  id_kraj        INT          NOT NULL,
  email          VARCHAR(50)  NULL,
  telefon        VARCHAR(15)  NULL,
  PRIMARY KEY (id_dijak),
  CONSTRAINT ck_dijak_spol CHECK (spol IN ('M', 'Ž')),
  CONSTRAINT fk_dijak_oddelek FOREIGN KEY (id_oddelek) REFERENCES oddelek (id_oddelek)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dijak_kraj FOREIGN KEY (id_kraj) REFERENCES kraj (id_kraj)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;

CREATE TABLE poucuje (
  id_ucitelj  INT  NOT NULL,
  id_predmet  INT  NOT NULL,
  id_oddelek  INT  NOT NULL,
  PRIMARY KEY (id_ucitelj, id_predmet, id_oddelek),
  CONSTRAINT fk_poucuje_ucitelj FOREIGN KEY (id_ucitelj) REFERENCES ucitelj (id_ucitelj) ON DELETE CASCADE,
  CONSTRAINT fk_poucuje_predmet FOREIGN KEY (id_predmet) REFERENCES predmet (id_predmet) ON DELETE CASCADE,
  CONSTRAINT fk_poucuje_oddelek FOREIGN KEY (id_oddelek) REFERENCES oddelek (id_oddelek) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;

CREATE TABLE ocena (
  id_ocena    INT          NOT NULL AUTO_INCREMENT,
  id_dijak    INT          NOT NULL,
  id_predmet  INT          NOT NULL,
  id_ucitelj  INT          NOT NULL,
  ocena       TINYINT      NOT NULL,
  vrsta       VARCHAR(10)  NOT NULL,
  datum       DATE         NOT NULL,
  PRIMARY KEY (id_ocena),
  CONSTRAINT ck_ocena_ocena CHECK (ocena BETWEEN 1 AND 5),
  CONSTRAINT ck_ocena_vrsta CHECK (vrsta IN ('pisna', 'ustna', 'projekt')),
  CONSTRAINT fk_ocena_dijak FOREIGN KEY (id_dijak) REFERENCES dijak (id_dijak)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ocena_predmet FOREIGN KEY (id_predmet) REFERENCES predmet (id_predmet)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ocena_ucitelj FOREIGN KEY (id_ucitelj) REFERENCES ucitelj (id_ucitelj)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;

CREATE TABLE izostanek (
  id_izostanek  INT          NOT NULL AUTO_INCREMENT,
  id_dijak      INT          NOT NULL,
  datum         DATE         NOT NULL,
  ure           TINYINT      NOT NULL,
  opravicen     BOOLEAN      NOT NULL DEFAULT 0,
  opomba        VARCHAR(60)  NULL,
  PRIMARY KEY (id_izostanek),
  CONSTRAINT ck_izostanek_ure CHECK (ure BETWEEN 1 AND 8),
  CONSTRAINT fk_izostanek_dijak FOREIGN KEY (id_dijak) REFERENCES dijak (id_dijak)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;

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
