-- ============================================================
-- Šolska baza SOLA · LAV-RAČ4 · poglavje 4 (SQL DDL)
-- Samo STRUKTURA (brez podatkov): osem tabel, ključi in omejitve.
-- MySQL 8.0 · utf8mb4 · slovenska collation.
-- Uporaba: v MySQL Workbench dvoklikni SVOJO shemo (postane krepka),
--          File > Open SQL Script > sola_struktura.sql in zaženi (strela).
-- Skripta najprej izbriše tabele z istimi imeni v izbrani shemi (tudi tiste, ki si jih naredil sam). Za vsako poglavje uporabi svojo shemo (npr. sola4, sola5).
-- To je REŠITEV vodene vaje: najprej poskusi tabele ustvariti sam.
-- Poglavje 5 uvozi skripto sola.sql: ta isto strukturo napolni s podatki.
-- ============================================================
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
