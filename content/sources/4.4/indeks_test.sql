-- ============================================================
-- Testna tabela za strani o indeksih (poglavje 4, razlaga 13)
-- 10.000 vrstic izmišljenih zapisov. Ustvari tabelo t_zapis v TVOJI shemi.
-- Uporaba: dvoklikni svojo shemo, File > Open SQL Script, zaženi (strela).
-- ============================================================
SET NAMES utf8mb4;
DROP TABLE IF EXISTS t_zapis;
CREATE TABLE t_zapis (
  id_zapis  INT          NOT NULL AUTO_INCREMENT,
  koda      CHAR(7)      NOT NULL,
  priimek   VARCHAR(20)  NOT NULL,
  mesto     VARCHAR(20)  NOT NULL,
  znesek    DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (id_zapis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;

SET SESSION cte_max_recursion_depth = 10000;
INSERT INTO t_zapis (koda, priimek, mesto, znesek)
WITH RECURSIVE n (i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 10000)
SELECT CONCAT('K', LPAD((i * 7919) % 10000, 6, '0')),
       ELT(1 + (i * 31) % 10, 'Novak','Kovač','Horvat','Krajnc','Zupan','Bregar','Kos','Žagar','Turk','Pavlin'),
       ELT(1 + (i * 17) % 6, 'Novo mesto','Ljubljana','Kranj','Trebnje','Metlika','Brežice'),
       ROUND(5 + (i * 37) % 99500 / 100, 2)
FROM n;

SELECT COUNT(*) AS vrstic FROM t_zapis;   -- 10000
