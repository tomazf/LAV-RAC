-- ============================================================
-- MATURA_BAZE · RAČ-LAV 4 · poglavje 5 (SQL poizvedbe)
-- Tabele iz maturitetnih nalog (izpitna pola 2, 2012–2026)
-- z izmišljenimi podatki. Predpona = šifra pole (m171_film = pola M171).
-- Imena stolpcev so enaka kot na poli. Če se shema na več polah
-- ponovi, je tabela ena (npr. m141_kupec velja tudi za M201).
-- Uvoz: dvoklikni SVOJO shemo, odpri datoteko in jo zaženi.
-- MySQL 8.0 · utf8mb4
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS
  m261_prijava, m261_predmet, m261_kandidat, m261_sola, m252_dijak, m252_oddelek,
  m251_racun, m251_stranka, m251_izdelek, m251_zaposlen, m242_ocena, m242_predmet,
  m242_kandidat, m242_sola, m242_artikel, m242_dobavitelj, m242_kategorija, m241_ucnaura,
  m241_ucitelj, m241_predmet, m232_izdelek, m232_dobavitelj, m232_potovanje, m232_stranka,
  m232_agent, m231_student, m231_status, m222_rezultat, m222_tekmovanje, m222_dijak,
  m222_sola, m221_racun, m221_oseba, m221_banka, m221_elipsa, m212_skok,
  m212_tekmovalec, m211_interes, m211_hobi, m211_prijatelji, m202_dijak, m202_pokrajina,
  m202_drzava, m201_vozilo, m192_opravljanje, m192_student, m192_izpit, m192_status,
  m192_predmet, m191_vozilo, m191_proizvajalec, m191_aplikacije, m191_avtorji, m182_narocilo,
  m182_uporabnik, m182_aplikacije, m181_jeprebrala, m181_oseba, m181_knjiga, m171_igra,
  m171_igralec, m171_film, m171_zvrst, m162_izpit, m162_predavatelj, m162_predmet,
  m162_student, m161_racun, m161_trgovina, m161_kupec, m161_tab, m152_kandidat,
  m152_osnovnasola, m152_kraj, m151_urnik, m151_dvorana, m151_dejavnost, m151_pregled,
  m151_pacient, m151_zdravnik, m141_nakup, m141_izdelek, m141_kupec, m141_vozilo,
  m132_dijak, m132_opravljadejavnost, m132_podjetje, m132_dejavnost, m131_hotel, m131_kraj,
  m121_uporaba, m121_portal, m121_kategorijap, m121_oseba;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------- M121 · spletni portali ----------
CREATE TABLE m121_oseba (OsebaID INT NOT NULL PRIMARY KEY, Priimek VARCHAR(20) NOT NULL, Ime VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m121_kategorijap (KategorijaID INT NOT NULL PRIMARY KEY, ImeKategorije VARCHAR(30) NOT NULL, OpisKategorije VARCHAR(100)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m121_portal (PortalID INT NOT NULL PRIMARY KEY, ImePortala VARCHAR(30) NOT NULL, KategorijaID INT NOT NULL, CenaUporabe DECIMAL(8,2) NOT NULL,
  FOREIGN KEY (KategorijaID) REFERENCES m121_kategorijap(KategorijaID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m121_uporaba (OsebaID INT NOT NULL, PortalID INT NOT NULL, DatumRegistracije DATE NOT NULL, PRIMARY KEY (OsebaID, PortalID),
  FOREIGN KEY (OsebaID) REFERENCES m121_oseba(OsebaID), FOREIGN KEY (PortalID) REFERENCES m121_portal(PortalID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m121_oseba VALUES (1,'Zupan','Tina'),(2,'Čeh','Marko'),(3,'Avsec','Petra'),(4,'Kranjc','Boris'),(5,'Šuštar','Ana'),(6,'Bele','Jure'),(7,'Novak','Eva');
INSERT INTO m121_kategorijap VALUES (1,'Izobraževanje','tečaji in učilnice'),(2,'Zabava','igre in glasba'),(3,'Novice',NULL);
INSERT INTO m121_portal VALUES (707,'UčimSe.si',1,12.00),(708,'Jezikovnik',1,8.50),(710,'IgraNet',2,5.00),(711,'Glasbomat',2,7.90),(720,'Dnevnik24',3,3.00);
INSERT INTO m121_uporaba VALUES (1,707,'2011-09-03'),(2,707,'2011-10-11'),(3,707,'2012-01-20'),(5,707,'2011-11-05'),(2,710,'2011-12-01'),(4,710,'2012-02-14'),(6,711,'2012-03-01'),(7,720,'2011-09-15'),(3,708,'2012-02-02');

-- ---------- M131 · hoteli ----------
CREATE TABLE m131_kraj (KrajID INT NOT NULL PRIMARY KEY, ImeKraja CHAR(30) NOT NULL, OpisKraja VARCHAR(120)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m131_hotel (HotelID INT NOT NULL PRIMARY KEY, ImeHotela CHAR(20) NOT NULL, PredstavitevHotela VARCHAR(20) NOT NULL, KrajID INT NOT NULL,
  FOREIGN KEY (KrajID) REFERENCES m131_kraj(KrajID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m131_kraj VALUES (1,'Ljubljana','glavno mesto'),(2,'Bled','jezero in grad'),(3,'Portorož','obala'),(4,'Novo mesto',NULL);
INSERT INTO m131_hotel VALUES (1,'Slon','mestni hotel',1),(2,'Union','zgodovinski',1),(3,'Cubo','moderni',1),(4,'Park','ob jezeru',2),(5,'Toplice','wellness',2),(6,'Bernardin','ob morju',3),(7,'Krka','mestni hotel',4),(8,'Lev','poslovni',1);

-- ---------- M132 · podjetja (naloga 24) ----------
CREATE TABLE m132_dejavnost (DID INT NOT NULL PRIMARY KEY, ImeDejavnosti VARCHAR(20) NOT NULL, Opis VARCHAR(100)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m132_podjetje (PID INT NOT NULL PRIMARY KEY, ImePodjetja VARCHAR(30) NOT NULL, TTR VARCHAR(20) NOT NULL, Datum_registracije DATE NOT NULL, Datum_zaprtja DATE, Datum_stecaja DATE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m132_opravljadejavnost (PID INT NOT NULL, DID INT NOT NULL, Datum_prijave DATE NOT NULL, PRIMARY KEY (PID, DID),
  FOREIGN KEY (PID) REFERENCES m132_podjetje(PID), FOREIGN KEY (DID) REFERENCES m132_dejavnost(DID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m132_dejavnost VALUES (1,'Gradbeništvo',NULL),(2,'Trgovina',NULL),(3,'Računalništvo',NULL),(4,'Turizem',NULL),(5,'Kmetijstvo',NULL);
INSERT INTO m132_podjetje VALUES (1,'Gradnje Krka d.o.o.','SI56 0201 0001','2009-04-12',NULL,NULL),(2,'Bitni svet d.o.o.','SI56 0201 0002','2011-02-01',NULL,NULL),
 (3,'Zeleni vrt s.p.','SI56 0201 0003','2011-07-19',NULL,NULL),(4,'Alpe Tours d.o.o.','SI56 0201 0004','2010-05-05','2014-01-31',NULL),
 (5,'Algoritem d.o.o.','SI56 0201 0005','2011-11-30',NULL,NULL),(6,'Čista trgovina d.d.','SI56 0201 0006','2012-03-08',NULL,'2015-06-01'),(7,'Mlin Plut s.p.','SI56 0201 0007','2008-09-09',NULL,NULL);
INSERT INTO m132_opravljadejavnost VALUES (1,1,'2009-04-12'),(2,3,'2011-02-01'),(2,2,'2012-01-01'),(3,5,'2011-07-19'),(3,2,'2011-07-19'),(4,4,'2010-05-05'),(5,3,'2011-11-30'),(6,2,'2012-03-08'),(7,5,'2008-09-09');

-- ---------- M132 · dijaki (naloga 20) ----------
CREATE TABLE m132_dijak (DijakID INT NOT NULL, Priimek CHAR(20) NOT NULL, Ime CHAR(10) NOT NULL, DatumRojstva DATE, PRIMARY KEY (DijakID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m132_dijak VALUES (1,'Zorko','Maja','2005-02-11'),(2,'Kotar','Rok',NULL),(3,'Ambrož','Lea','2004-12-01'),(4,'Bevc','Gašper',NULL),(5,'Lenart','Ivo','2005-07-23'),(6,'Šenk','Teja',NULL);

-- ---------- M141 · vozila (naloga 18) ----------
CREATE TABLE m141_vozilo (RegSt INT NOT NULL PRIMARY KEY, Znamka VARCHAR(10) NOT NULL, Letnik INT NOT NULL, Cena INT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m141_vozilo VALUES (101,'Renault',2010,6500),(102,'Škoda',2012,9800),(103,'BMW',2011,21000),(104,'Renault',2013,8900),(105,'Fiat',2009,3200),(106,'Škoda',2008,4100),(107,'Audi',2012,18500),(108,'Fiat',2013,7200);

-- ---------- M141 + M201 · kupci in nakupi (M141/20, M201/19) ----------
CREATE TABLE m141_kupec (IDKupca INT NOT NULL PRIMARY KEY, Naziv VARCHAR(20) NOT NULL, Naslov VARCHAR(30)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m141_izdelek (IDIzdelka INT NOT NULL PRIMARY KEY, Naziv VARCHAR(20) NOT NULL, Opis VARCHAR(100), Cena DECIMAL(8,2) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m141_nakup (IDKupca INT NOT NULL, IDIzdelka INT NOT NULL, DatumNakupa DATE NOT NULL, PRIMARY KEY (IDKupca, IDIzdelka, DatumNakupa),
  FOREIGN KEY (IDKupca) REFERENCES m141_kupec(IDKupca), FOREIGN KEY (IDIzdelka) REFERENCES m141_izdelek(IDIzdelka)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m141_kupec VALUES (1,'Mercator','Dunajska 107, Ljubljana'),(2,'Tuš','Cesta v Trnovlje 10, Celje'),(3,'Spar','Šmartinska 152, Ljubljana'),(4,'Hofer','Kranjčeva 1, Ljubljana'),(5,'Jager','Partizanska 3, Ljubljana');
INSERT INTO m141_izdelek VALUES (1,'Mleko','1 l',0.99),(2,'Kruh','polbeli, 500 g',1.80),(3,'Jogurt','navadni',0.65),(4,'Sir','edamec 250 g',3.40),(5,'Kava','mleta 500 g',6.90);
INSERT INTO m141_nakup VALUES (1,2,'2013-12-23'),(1,2,'2013-12-24'),(2,2,'2013-12-24'),(3,1,'2013-12-24'),(3,4,'2013-12-24'),(3,2,'2013-12-27'),(4,5,'2013-12-24'),(4,2,'2013-12-30'),(5,3,'2013-12-20'),(1,2,'2014-01-02'),(1,5,'2013-12-24');

-- ---------- M151 · pregledi (naloga 18) ----------
CREATE TABLE m151_zdravnik (ZdravnikID INT NOT NULL PRIMARY KEY, Ime VARCHAR(20) NOT NULL, Priimek VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m151_pacient (PacientID INT NOT NULL PRIMARY KEY, Ime VARCHAR(20) NOT NULL, Priimek VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m151_pregled (ZdravnikID INT NOT NULL, PacientID INT NOT NULL, Datum DATE NOT NULL, Diagnoza VARCHAR(50), PredpisanaZdravila VARCHAR(50),
  PRIMARY KEY (ZdravnikID, PacientID, Datum), FOREIGN KEY (ZdravnikID) REFERENCES m151_zdravnik(ZdravnikID), FOREIGN KEY (PacientID) REFERENCES m151_pacient(PacientID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m151_zdravnik VALUES (1,'Mateja','Kos'),(2,'Igor','Vidic'),(3,'Darja','Pečar');
INSERT INTO m151_pacient VALUES (1,'Rok','Bajc'),(2,'Nina','Grm'),(3,'Aleš','Debeljak'),(4,'Lea','Fon');
INSERT INTO m151_pregled VALUES (1,1,'2015-03-02','prehlad','sirup'),(1,2,'2015-03-02','angina','antibiotik'),(1,1,'2015-04-10','kontrola',NULL),(2,3,'2015-03-05','zlom','opornica'),
 (1,4,'2015-05-12','alergija','antihistaminik'),(3,2,'2015-06-01','kontrola',NULL),(2,1,'2015-06-02','prehlad',NULL),(1,3,'2015-06-15','vnetje','antibiotik');

-- ---------- M151 · dvorane (naloga 19.2, shema prirejena) ----------
CREATE TABLE m151_dejavnost (Koda CHAR(3) NOT NULL PRIMARY KEY, Ime VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m151_dvorana (DvoranaID INT NOT NULL PRIMARY KEY, ImeDvorane VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m151_urnik (DvoranaID INT NOT NULL, Datum DATE NOT NULL, Ura TIME NOT NULL, Koda CHAR(3) NOT NULL, PRIMARY KEY (DvoranaID, Datum, Ura), UNIQUE (DvoranaID, Datum, Koda),
  FOREIGN KEY (DvoranaID) REFERENCES m151_dvorana(DvoranaID), FOREIGN KEY (Koda) REFERENCES m151_dejavnost(Koda)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m151_dejavnost VALUES ('KOS','košarka'),('ODB','odbojka'),('ROK','rokomet'),('BAD','badminton');
INSERT INTO m151_dvorana VALUES (1,'Velika dvorana'),(2,'Mala dvorana'),(3,'Dvorana Marof');
INSERT INTO m151_urnik VALUES (1,'2015-09-07','17:00','KOS'),(1,'2015-09-07','19:00','ROK'),(2,'2015-09-07','17:00','ODB'),(3,'2015-09-08','18:00','KOS'),(1,'2015-09-09','17:00','KOS'),(2,'2015-09-09','20:00','BAD'),(3,'2015-09-10','18:00','ODB');

-- ---------- M152 · kandidati ----------
CREATE TABLE m152_kraj (KID INT NOT NULL PRIMARY KEY, ImeKraja VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m152_osnovnasola (OSID INT NOT NULL PRIMARY KEY, ImeSole VARCHAR(30) NOT NULL, KID INT NOT NULL, FOREIGN KEY (KID) REFERENCES m152_kraj(KID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m152_kandidat (EMSO CHAR(13) NOT NULL PRIMARY KEY, Priimek VARCHAR(20) NOT NULL, Ime VARCHAR(10) NOT NULL, KID INT NOT NULL, OSID INT NOT NULL, Opombe VARCHAR(30),
  FOREIGN KEY (KID) REFERENCES m152_kraj(KID), FOREIGN KEY (OSID) REFERENCES m152_osnovnasola(OSID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m152_kraj VALUES (1,'Medvode'),(2,'Ljubljana'),(3,'Škofja Loka');
INSERT INTO m152_osnovnasola VALUES (1,'OŠ Medvode',1),(2,'OŠ Preska',1),(3,'OŠ Vič',2),(4,'OŠ Ivana Groharja',3);
INSERT INTO m152_kandidat VALUES ('0101000500011','Zajc','Lara',1,1,NULL),('0202000500022','Bergant','Tim',1,2,NULL),('0303000500033','Oblak','Žan',2,3,NULL),('0404000505044','Čebašek','Mia',1,1,'prepis'),
 ('0505000500055','Jereb','Ana',3,4,NULL),('0606000500066','Arh','Gal',1,1,NULL),('0707000505077','Pintar','Iza',2,3,NULL);

-- ---------- M161 · naloga 16 in trgovine (naloga 20) ----------
CREATE TABLE m161_tab (A INT NOT NULL, B INT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m161_tab VALUES (10,1),(15,2),(20,1),(30,1),(35,2);
CREATE TABLE m161_kupec (st_kupca INT NOT NULL PRIMARY KEY, priimek VARCHAR(15) NOT NULL, ime VARCHAR(15) NOT NULL, naslov VARCHAR(20), kraj VARCHAR(20)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m161_trgovina (st_trgovine INT NOT NULL PRIMARY KEY, ime_trgovine VARCHAR(20) NOT NULL, kraj VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m161_racun (st_racuna INT NOT NULL PRIMARY KEY, st_trgovine INT NOT NULL, st_kupca INT NOT NULL, datum DATE NOT NULL, znesek DECIMAL(8,2) NOT NULL,
  FOREIGN KEY (st_trgovine) REFERENCES m161_trgovina(st_trgovine), FOREIGN KEY (st_kupca) REFERENCES m161_kupec(st_kupca)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m161_kupec VALUES (1,'Kekec','Peter','Pod goro 1','Butale'),(2,'Klepec','Peter','Ob potoku 3','Butale'),(3,'Krpan','Martin','Vrh 12','Vrh'),(4,'Bedanec','Jaka','Gozdna 5','Butale'),(5,'Pehta','Teta','Jasa 2','Kekčeva dežela');
INSERT INTO m161_trgovina VALUES (1,'Abrakadabra','Butale'),(2,'Abrakadabra','Tepanje'),(3,'Pri Mački','Butale');
INSERT INTO m161_racun VALUES (1,1,1,'2016-05-02',120.50),(2,1,2,'2016-05-02',45.00),(3,1,3,'2016-05-02',230.00),(4,2,4,'2016-05-03',150.00),(5,1,1,'2016-05-03',80.00),
 (6,3,5,'2016-05-03',310.00),(7,1,5,'2016-05-04',101.00),(8,1,2,'2016-05-04',100.00),(9,1,4,'2016-05-04',12.40);

-- ---------- M162 · izpiti ----------
CREATE TABLE m162_student (VpisnaSt CHAR(6) NOT NULL PRIMARY KEY, Ime VARCHAR(15) NOT NULL, Priimek VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m162_predmet (PredmetID CHAR(3) NOT NULL PRIMARY KEY, ImePredmeta VARCHAR(15) NOT NULL, KreditneTocke INT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m162_predavatelj (PredavateljID CHAR(4) NOT NULL PRIMARY KEY, ImePred VARCHAR(15) NOT NULL, PriimekPred VARCHAR(20) NOT NULL, status VARCHAR(15)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m162_izpit (VpisnaSt CHAR(6) NOT NULL, PredmetID CHAR(3) NOT NULL, Datum DATE NOT NULL, Ocena INT NOT NULL, PredavateljID CHAR(4) NOT NULL,
  PRIMARY KEY (VpisnaSt, PredmetID, Datum), FOREIGN KEY (VpisnaSt) REFERENCES m162_student(VpisnaSt), FOREIGN KEY (PredmetID) REFERENCES m162_predmet(PredmetID),
  FOREIGN KEY (PredavateljID) REFERENCES m162_predavatelj(PredavateljID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m162_student VALUES ('630001','Nina','Kralj'),('630002','Jure','Mlakar'),('630003','Sara','Logar'),('630004','Blaž','Jerman');
INSERT INTO m162_predmet VALUES ('MA1','Matematika 1',8),('PR1','Programiranje 1',6),('ANG','Angleščina',3),('FIZ','Fizika',5),('PB1','Podatkovne baze',6);
INSERT INTO m162_predavatelj VALUES ('P001','Janez','Bohinc','redni prof.'),('P002','Marta','Rupnik','docentka'),('P003','Igor','Zalar',NULL);
INSERT INTO m162_izpit VALUES ('630001','MA1','2016-01-20',8,'P001'),('630001','PR1','2016-01-27',9,'P002'),('630001','ANG','2016-02-03',5,'P003'),('630002','MA1','2016-01-20',5,'P001'),
 ('630002','MA1','2016-02-10',6,'P001'),('630002','PR1','2016-01-27',7,'P002'),('630003','MA1','2016-01-20',10,'P001'),('630003','PR1','2016-01-27',10,'P002'),('630003','FIZ','2016-02-05',9,'P003'),('630004','FIZ','2016-02-05',4,'P003');

-- ---------- M171 + M172 · filmi ----------
CREATE TABLE m171_zvrst (ZID INT NOT NULL PRIMARY KEY, ImeZvrsti VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m171_film (FID INT NOT NULL PRIMARY KEY, Naslov VARCHAR(30) NOT NULL, Leto INT NOT NULL, ZID INT NOT NULL, FOREIGN KEY (ZID) REFERENCES m171_zvrst(ZID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m171_igralec (ID INT NOT NULL PRIMARY KEY, Ime VARCHAR(20) NOT NULL, Priimek VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m171_igra (ID INT NOT NULL, FID INT NOT NULL, Vloga VARCHAR(20) NOT NULL, PRIMARY KEY (ID, FID),
  FOREIGN KEY (ID) REFERENCES m171_igralec(ID), FOREIGN KEY (FID) REFERENCES m171_film(FID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m171_zvrst VALUES (1,'drama'),(2,'komedija'),(3,'fantastika');
INSERT INTO m171_film VALUES (1,'Amarcord',1973,2),(2,'Vrba',2016,1),(3,'Zvezdna pot',2016,3),(4,'Kekec',1951,1),(5,'Nočni vlak',2015,1),(6,'Avtobus',2016,2);
INSERT INTO m171_igralec VALUES (1,'Bruno','Zanin'),(2,'Pupella','Maggio'),(3,'Armando','Brancia'),(4,'Magali','Noël'),(5,'Ciccio','Ingrassia'),(6,'Mojca','Funkl'),(7,'Jure','Henigman'),(8,'Nataša','Barbara Gračner'),(9,'Boris','Cavazza'),(10,'Polde','Bibič');
INSERT INTO m171_igra VALUES (1,1,'Titta'),(2,1,'mati'),(3,1,'oče'),(4,1,'Gradisca'),(5,1,'stric Teo'),(6,2,'Ana'),(7,2,'Rok'),(8,2,'mati'),(9,2,'oče'),(10,2,'ded'),
 (7,3,'kapitan'),(9,3,'robot'),(10,4,'Kosobrin'),(6,5,'sprevodnica'),(7,5,'potnik'),(8,5,'potnica'),(9,5,'kondukter'),(6,6,'voznica'),(8,6,'potnica');

-- ---------- M181 · knjige ----------
CREATE TABLE m181_knjiga (ISBN BIGINT NOT NULL PRIMARY KEY, Ime_knjige VARCHAR(40) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m181_oseba (EMSO CHAR(13) NOT NULL PRIMARY KEY, Priimek VARCHAR(20) NOT NULL, Ime VARCHAR(10) NOT NULL, Naslov VARCHAR(30), Kraj VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m181_jeprebrala (EMSO CHAR(13) NOT NULL, ISBN BIGINT NOT NULL, Datum DATE NOT NULL, PRIMARY KEY (EMSO, ISBN),
  FOREIGN KEY (EMSO) REFERENCES m181_oseba(EMSO), FOREIGN KEY (ISBN) REFERENCES m181_knjiga(ISBN)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m181_knjiga VALUES (9789610100011,'Martin Krpan'),(9789610100028,'Deseti brat'),(9789610100035,'Alamut'),(9789610100042,'Cvetje v jeseni'),(9789610100059,'Butalci'),(9789610100066,'Na klancu');
INSERT INTO m181_oseba VALUES ('1505980505123','Jošt','Milena','Celovška 10','Ljubljana'),('2302975500111','Rihtar','Boris','Glavni trg 2','Kranj'),('0907990505222','Dolinar','Vesna','Trubarjeva 5','Ljubljana'),
 ('1111985500333','Ivanc','Peter','Prešernova 8','Maribor'),('0404001505444','Ahčin','Zala','Zaloška 21','Ljubljana');
INSERT INTO m181_jeprebrala VALUES ('1505980505123',9789610100035,'2017-02-10'),('1505980505123',9789610100011,'2017-03-01'),('1505980505123',9789610100059,'2017-06-20'),('2302975500111',9789610100028,'2017-01-15'),
 ('0907990505222',9789610100035,'2017-04-04'),('1111985500333',9789610100042,'2017-05-05'),('0404001505444',9789610100066,'2017-09-09');

-- ---------- M182 + M192 · aplikacije (M182/16, M192/18) ----------
CREATE TABLE m182_aplikacije (ID INT NOT NULL PRIMARY KEY, ime VARCHAR(30) NOT NULL, kategorija VARCHAR(20) NOT NULL, stPrenosov INT NOT NULL, cena DECIMAL(5,2) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m182_aplikacije VALUES (1,'Srečni Joža','igra',12675,0.00),(2,'Bloki','igra',212,0.99),(3,'Brsk','novice',4358,0.99),(4,'321BUM','igra',11234,1.99),(5,'Vreme+','orodje',25410,0.00),
 (6,'Slovar','izobraževanje',8120,2.99),(7,'Šah mojster','igra',3050,0.99),(8,'Budilka','orodje',980,0.00);

-- ---------- M182 · naročila (naloga 19) ----------
CREATE TABLE m182_uporabnik (UID INT NOT NULL PRIMARY KEY, IME VARCHAR(20) NOT NULL, PRIIMEK VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m182_narocilo (UID INT NOT NULL, NID INT NOT NULL, DATUM DATE NOT NULL, OPOMBA VARCHAR(20), ZNESEK DECIMAL(8,2) NOT NULL, PRIMARY KEY (UID, NID),
  FOREIGN KEY (UID) REFERENCES m182_uporabnik(UID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m182_uporabnik VALUES (1,'Janez','Novak'),(2,'Maja','Kern'),(3,'Janez','Kos'),(4,'Tina','Novak'),(5,'Rok','Babič');
INSERT INTO m182_narocilo VALUES (1,1,'2016-02-11',NULL,24.90),(1,2,'2016-06-30','darilo',55.00),(1,3,'2017-01-05',NULL,12.40),(2,1,'2016-03-03',NULL,99.99),(2,2,'2016-12-24','nujno',15.00),
 (2,3,'2016-12-28',NULL,7.50),(3,1,'2015-11-11',NULL,40.00),(4,1,'2016-07-07',NULL,18.20),(4,2,'2017-02-02',NULL,30.00);

-- ---------- M191 · aplikacije in avtorji (naloga 16) ----------
CREATE TABLE m191_avtorji (IDAvtorja INT NOT NULL PRIMARY KEY, naziv VARCHAR(30) NOT NULL, letoUstanovitve INT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m191_aplikacije (ID INT NOT NULL PRIMARY KEY, IDAvtorja INT NOT NULL, ime VARCHAR(20) NOT NULL, kategorija VARCHAR(20) NOT NULL, stPrenosov INT NOT NULL, cena DECIMAL(5,2) NOT NULL,
  FOREIGN KEY (IDAvtorja) REFERENCES m191_avtorji(IDAvtorja)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m191_avtorji VALUES (1,'Mirkomehki s.p.',2010),(2,'Gamezzz',2000),(3,'Maturko d.o.o',2015);
INSERT INTO m191_aplikacije VALUES (1000,1,'Srečni Joža','igra',12675,0.00),(1001,2,'Bloki','igra',212,0.99),(1002,3,'Brsk','novice',4358,0.99),(1003,3,'321BUM','igra',11234,1.99);

-- ---------- M191 · vozila in proizvajalci (naloga 20) ----------
CREATE TABLE m191_proizvajalec (proizvajalecid VARCHAR(20) NOT NULL PRIMARY KEY, ime VARCHAR(20) NOT NULL, drzava VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m191_vozilo (voziloID VARCHAR(10) NOT NULL PRIMARY KEY, model VARCHAR(10) NOT NULL, proizvajalecid VARCHAR(20) NOT NULL, letoizdelave INT NOT NULL, tipopreme VARCHAR(15),
  stevilovrat INT NOT NULL, menjalnik VARCHAR(20) NOT NULL, tipgoriva VARCHAR(20) NOT NULL, FOREIGN KEY (proizvajalecid) REFERENCES m191_proizvajalec(proizvajalecid)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m191_proizvajalec VALUES ('REN','Renault','Francija'),('VW','Volkswagen','Nemčija'),('SKO','Škoda','Češka'),('FIA','Fiat','Italija');
INSERT INTO m191_vozilo VALUES ('V01','Clio','REN',2026,'osnovna',5,'ročni','bencin'),('V02','Captur','REN',2026,'polna',5,'avtomatski','hibrid'),('V03','Twingo','REN',2025,NULL,3,'ročni','električni'),
 ('V04','Golf','VW',2026,'polna',5,'avtomatski','dizel'),('V05','Polo','VW',2024,'osnovna',5,'ročni','bencin'),('V06','Octavia','SKO',2026,'srednja',5,'ročni','dizel'),
 ('V07','Fabia','SKO',2026,'osnovna',5,'ročni','bencin'),('V08','Kodiaq','SKO',2026,'polna',5,'avtomatski','hibrid'),('V09','Panda','FIA',2025,'osnovna',5,'ročni','bencin'),('V10','Clio','REN',2027,'polna',5,'ročni','bencin');

-- ---------- M192 · izpiti ----------
CREATE TABLE m192_predmet (PredmetID INT NOT NULL PRIMARY KEY, ImePredmeta VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m192_status (StatusID INT NOT NULL PRIMARY KEY, ImeStatusa VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m192_izpit (IzpitID INT NOT NULL PRIMARY KEY, PredmetID INT NOT NULL, Datum DATE NOT NULL, Opombe VARCHAR(20), FOREIGN KEY (PredmetID) REFERENCES m192_predmet(PredmetID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m192_student (StudentID INT NOT NULL PRIMARY KEY, Ime VARCHAR(20) NOT NULL, Priimek VARCHAR(20) NOT NULL, StatusID INT NOT NULL, FOREIGN KEY (StatusID) REFERENCES m192_status(StatusID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m192_opravljanje (IzpitID INT NOT NULL, StudentID INT NOT NULL, Ocena INT NOT NULL, PRIMARY KEY (IzpitID, StudentID),
  FOREIGN KEY (IzpitID) REFERENCES m192_izpit(IzpitID), FOREIGN KEY (StudentID) REFERENCES m192_student(StudentID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m192_predmet VALUES (1,'Matematika'),(2,'Fizika'),(3,'Programiranje'),(4,'Statistika');
INSERT INTO m192_status VALUES (1,'redni'),(2,'izredni');
INSERT INTO m192_izpit VALUES (1,1,'2017-01-25',NULL),(2,1,'2017-02-15','pisni del'),(3,1,'2017-06-20',NULL),(4,2,'2017-01-30',NULL),(5,3,'2016-06-10',NULL),(6,3,'2017-09-01',NULL),(7,4,'2017-02-01','odpovedan'),(8,2,'2018-01-29',NULL);
INSERT INTO m192_student VALUES (1,'Luka','Žagar',1),(2,'Petra','Hribar',1),(3,'Matej','Ule',2),(4,'Saša','Pirc',1);
INSERT INTO m192_opravljanje VALUES (1,1,5),(2,1,6),(3,1,8),(1,2,9),(1,3,5),(3,3,7),(4,2,8),(5,4,10),(6,1,7),(4,4,6);

-- ---------- M201 · vozila (naloga 15) ----------
CREATE TABLE m201_vozilo (RegSt VARCHAR(10) NOT NULL PRIMARY KEY, Znamka VARCHAR(20) NOT NULL, Letnik INT NOT NULL, Lastnik VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m201_vozilo VALUES ('NM AB-123','Renault',2013,'Plut'),('LJ KK-881','Škoda',2015,'Hrovat'),('NM 45-ZZ1','Renault',2010,'Kastelic'),('KR UL-007','BMW',2013,'Rus'),('CE 12-PPP','Fiat',2013,'Lah'),('NM ŠK-555','Škoda',2018,'Bevc');

-- ---------- M202 · države in pokrajine ----------
CREATE TABLE m202_drzava (DID INT NOT NULL PRIMARY KEY, ImeDrzave VARCHAR(30) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m202_pokrajina (PID INT NOT NULL PRIMARY KEY, ImePokrajine VARCHAR(30) NOT NULL, DID INT NOT NULL, SteviloPrebivalcev INT NOT NULL, FOREIGN KEY (DID) REFERENCES m202_drzava(DID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m202_drzava VALUES (1,'Slovenija'),(2,'Hrvaška'),(3,'Avstrija');
INSERT INTO m202_pokrajina VALUES (1,'Štajerska',1,708000),(2,'Gorenjska',1,206000),(3,'Dolenjska',1,145000),(4,'Primorska',1,290000),(5,'Prekmurje',1,80000),(6,'Koroška',1,70000),(7,'Notranjska',1,52000),
 (8,'Istra',2,195000),(9,'Dalmacija',2,850000),(10,'Slavonija',2,800000),(11,'Koroška',3,564000),(12,'Štajerska',3,1253000),(13,'Tirolska',3,760000);

-- ---------- M202 · dijaki (naloga 14) ----------
CREATE TABLE m202_dijak (DijakID INT NOT NULL PRIMARY KEY, Priimek VARCHAR(20) NOT NULL, Ime VARCHAR(20) NOT NULL, Ocena INT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m202_dijak VALUES (1,'Mohar','Lan',3),(2,'Gerden','Iva',5),(3,'Sajovic','Bor',2),(4,'Dolenc','Nuša',4),(5,'Rems','Val',5);

-- ---------- M211 · prijatelji in hobiji ----------
CREATE TABLE m211_prijatelji (id CHAR(4) NOT NULL PRIMARY KEY, Ime CHAR(15) NOT NULL, Priimek CHAR(20) NOT NULL, telefon CHAR(13) NOT NULL, email CHAR(25) NOT NULL, spol CHAR(1) NOT NULL, izobrazba CHAR(15) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m211_hobi (id_hobija CHAR(4) NOT NULL PRIMARY KEY, ime_hobija CHAR(25) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m211_interes (id CHAR(4) NOT NULL, id_hobija CHAR(4) NOT NULL, PRIMARY KEY (id, id_hobija),
  FOREIGN KEY (id) REFERENCES m211_prijatelji(id), FOREIGN KEY (id_hobija) REFERENCES m211_hobi(id_hobija)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m211_prijatelji VALUES ('P001','Matija','Rus','041 111 222','matija@mail.si','M','srednja'),('P002','Urša','Leban','031 222 333','ursa@mail.si','Ž','visoka'),
 ('P003','Kristjan','Brajer','040 333 444','kristjan@mail.si','M','srednja'),('P004','Nives','Godec','051 444 555','nives@mail.si','Ž','magisterij'),('P005','Alen','Vodnik','070 555 666','alen@mail.si','M','visoka');
INSERT INTO m211_hobi VALUES ('H001','lokostrelstvo'),('H002','planinarjenje'),('H003','šah'),('H004','fotografija'),('H005','potapljanje');
INSERT INTO m211_interes VALUES ('P001','H001'),('P001','H002'),('P002','H002'),('P002','H004'),('P003','H001'),('P003','H003'),('P004','H002'),('P005','H001'),('P005','H004');

-- ---------- M212 · smučarski skoki ----------
CREATE TABLE m212_tekmovalec (TID INT NOT NULL PRIMARY KEY, ime VARCHAR(10) NOT NULL, priimek VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m212_skok (TID INT NOT NULL, serija INT NOT NULL, dolzina INT NOT NULL, PRIMARY KEY (TID, serija), FOREIGN KEY (TID) REFERENCES m212_tekmovalec(TID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m212_tekmovalec VALUES (1,'Peter','Prevc'),(2,'Anže','Lanišek'),(3,'Timi','Zajc'),(4,'Domen','Prevc'),(5,'Lovro','Kos');
INSERT INTO m212_skok VALUES (1,1,104),(1,2,108),(2,1,101),(2,2,99),(3,1,97),(3,2,103),(4,1,110),(4,2,106),(5,1,100);

-- ---------- M221 · elipse (naloga 15) ----------
CREATE TABLE m221_elipsa (id INT NOT NULL PRIMARY KEY, a INT NOT NULL, b INT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m221_elipsa VALUES (1,5,3),(2,10,4),(3,12,12),(4,20,7),(5,21,9),(6,15,15),(7,9,2),(8,30,10);

-- ---------- M221 · banke (naloga 19) ----------
CREATE TABLE m221_banka (BID INT NOT NULL PRIMARY KEY, ImeBanke VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m221_oseba (DavcnaSt INT NOT NULL PRIMARY KEY, Ime VARCHAR(20) NOT NULL, Priimek VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m221_racun (StevilkaRacuna INT NOT NULL PRIMARY KEY, DavcnaSt INT NOT NULL, BID INT NOT NULL, Stanje DECIMAL(10,2) NOT NULL, Opomba VARCHAR(20),
  FOREIGN KEY (DavcnaSt) REFERENCES m221_oseba(DavcnaSt), FOREIGN KEY (BID) REFERENCES m221_banka(BID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m221_banka VALUES (100,'Ljubljanska'),(200,'Dolenjska'),(300,'Kekec');
INSERT INTO m221_oseba VALUES (11111111,'Marija','Zalokar'),(22222222,'Franc','Gorše'),(33333333,'Simon','Lavrič'),(44444444,'Ida','Rajh');
INSERT INTO m221_racun VALUES (1001,11111111,100,8500.00,NULL),(1002,11111111,300,2100.00,'kredit'),(1003,22222222,200,15400.00,NULL),(1004,33333333,100,4000.00,NULL),
 (1005,33333333,200,3500.00,'kredit'),(1006,33333333,300,2500.00,NULL),(1007,44444444,300,-150.00,'kredit'),(1008,22222222,300,300.00,'kredit');

-- ---------- M222 · tekmovanja ----------
CREATE TABLE m222_sola (SID INT NOT NULL PRIMARY KEY, ImeSole VARCHAR(30) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m222_dijak (SolaID INT NOT NULL, ZapSt INT NOT NULL, Ime VARCHAR(20) NOT NULL, Priimek VARCHAR(30) NOT NULL, Spol CHAR(1) NOT NULL, PRIMARY KEY (SolaID, ZapSt),
  FOREIGN KEY (SolaID) REFERENCES m222_sola(SID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m222_tekmovanje (TID INT NOT NULL PRIMARY KEY, ImeTekmovanja VARCHAR(40) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m222_rezultat (TID INT NOT NULL, SolaID INT NOT NULL, ZapSt INT NOT NULL, Mesto INT NOT NULL, PRIMARY KEY (TID, SolaID, ZapSt),
  FOREIGN KEY (TID) REFERENCES m222_tekmovanje(TID), FOREIGN KEY (SolaID, ZapSt) REFERENCES m222_dijak(SolaID, ZapSt)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m222_sola VALUES (1,'OŠ Martin Krpan'),(2,'OŠ Peter Klepec'),(3,'OŠ Zvonček'),(4,'OŠ Miki Miška');
INSERT INTO m222_dijak VALUES (1,1,'Ožbej','Zorman','M'),(1,2,'Lija','Kern','Ž'),(1,3,'Mark','Hladnik','M'),(2,1,'Tara','Bezjak','Ž'),(2,2,'Nik','Ambrožič','M'),
 (3,1,'Vid','Možina','M'),(3,2,'Ela','Cimerman','Ž'),(4,1,'Sven','Babnik','M'),(4,2,'Kaja','Erjavec','Ž');
INSERT INTO m222_tekmovanje VALUES (1,'Bralna značka 2018'),(2,'Bober 2018'),(3,'Bralna značka 2019');
INSERT INTO m222_rezultat VALUES (1,1,1,1),(1,2,1,1),(1,3,2,2),(1,1,2,3),(1,4,1,4),(2,4,1,1),(2,4,2,2),(2,2,2,3),(2,2,1,4),(2,1,3,5),
 (3,1,1,1),(3,1,2,2),(3,3,1,3),(3,3,2,4),(3,2,1,5);

-- ---------- M231 · študenti ----------
CREATE TABLE m231_status (StatusID INT NOT NULL PRIMARY KEY, ImeStatusa VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m231_student (StudentID INT NOT NULL PRIMARY KEY, Ime VARCHAR(20) NOT NULL, Priimek VARCHAR(20) NOT NULL, StatusID INT NOT NULL, DatumRojstva DATE NOT NULL,
  FOREIGN KEY (StatusID) REFERENCES m231_status(StatusID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m231_status VALUES (1,'redni'),(2,'izredni'),(3,'absolvent');
INSERT INTO m231_student VALUES (1,'Marko','Pevec',2,'1998-04-11'),(2,'Lina','Oven',1,'2003-02-02'),(3,'Gorazd','Šket',2,'1995-12-30'),(4,'Mia','Čuk',2,'2000-01-01'),
 (5,'Rene','Volk',1,'1999-07-07'),(6,'Iris','Batič',2,'1999-12-31'),(7,'Simon','Avbelj',3,'1997-03-03');

-- ---------- M232 + M261 · turistična agencija ----------
CREATE TABLE m232_agent (IDSAgenta INT NOT NULL PRIMARY KEY, ime VARCHAR(20) NOT NULL, podrocje VARCHAR(50), telefon VARCHAR(16)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m232_stranka (IDStranke INT NOT NULL PRIMARY KEY, ime VARCHAR(20) NOT NULL, IDAgenta INT NOT NULL, boniteta INT, FOREIGN KEY (IDAgenta) REFERENCES m232_agent(IDSAgenta)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m232_potovanje (IDPotovanja INT NOT NULL PRIMARY KEY, znesek INT NOT NULL, IDStranke INT NOT NULL, IDAgenta INT NOT NULL,
  FOREIGN KEY (IDStranke) REFERENCES m232_stranka(IDStranke), FOREIGN KEY (IDAgenta) REFERENCES m232_agent(IDSAgenta)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m232_agent VALUES (1,'Sonja','Evropa','01 111 2222'),(2,'Marjan','Azija','01 333 4444'),(3,'Klara','Afrika',NULL);
INSERT INTO m232_stranka VALUES (1,'Gorazd',1,3),(2,'Helena',1,5),(3,'Rudi',2,2),(4,'Vanja',3,4),(5,'Edo',2,NULL);
INSERT INTO m232_potovanje VALUES (1,350,1,1),(2,99,2,1),(3,500,3,2),(4,1250,4,3),(5,100,5,2),(6,780,2,1),(7,420,4,3),(8,501,1,2);

-- ---------- M232 · izdelki in dobavitelji (naloga 20) ----------
CREATE TABLE m232_dobavitelj (dobaviteljID INT NOT NULL PRIMARY KEY, imeDobavitelja VARCHAR(30) NOT NULL, oznaka CHAR(1)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m232_izdelek (izdelekID INT NOT NULL PRIMARY KEY, imeIzdelka VARCHAR(20) NOT NULL, dobaviteljID INT NOT NULL, cena DECIMAL(8,2) NOT NULL, zaloga INT NOT NULL,
  FOREIGN KEY (dobaviteljID) REFERENCES m232_dobavitelj(dobaviteljID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m232_dobavitelj VALUES (1,'KupimProdam','A'),(2,'Vse za dom','B'),(3,'Tehno','A');
INSERT INTO m232_izdelek VALUES (1,'svinčnik',1,0.80,250),(2,'zvezek',1,2.50,120),(3,'nahrbtnik',1,35.00,8),(4,'svetilka',2,12.90,40),(5,'miška',3,15.00,5),(6,'tipkovnica',3,29.90,12);

-- ---------- M241 · eDnevnik ----------
CREATE TABLE m241_predmet (PID INT NOT NULL PRIMARY KEY, imePredmeta VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m241_ucitelj (UID INT NOT NULL PRIMARY KEY, ime VARCHAR(20) NOT NULL, priimek VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m241_ucnaura (PID INT NOT NULL, zaporednaStevilka INT NOT NULL, datum DATE NOT NULL, UID INT NOT NULL, vsebina VARCHAR(50), nacinIzvedbe VARCHAR(10) NOT NULL,
  PRIMARY KEY (PID, zaporednaStevilka), FOREIGN KEY (PID) REFERENCES m241_predmet(PID), FOREIGN KEY (UID) REFERENCES m241_ucitelj(UID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m241_predmet VALUES (1,'matematika'),(2,'slovenščina'),(3,'fizika');
INSERT INTO m241_ucitelj VALUES (1,'Saša','Zorc'),(2,'Andrej','Babič'),(3,'Meta','Čadež'),(4,'Pavel','Arko');
INSERT INTO m241_ucnaura VALUES (1,1,'2021-03-01',1,'ulomki','v šoli'),(1,2,'2021-03-02',1,'ulomki','na daljavo'),(1,3,'2021-03-03',3,'odstotki','na daljavo'),(1,4,'2021-03-04',1,'odstotki','v šoli'),
 (2,1,'2021-03-01',2,'Prešeren','na daljavo'),(2,2,'2021-03-03',2,'Cankar','v šoli'),(3,1,'2021-03-02',4,'sile','na daljavo'),(3,2,'2021-03-04',3,'navor','v šoli');

-- ---------- M242 · artikli (naloga 17) ----------
CREATE TABLE m242_kategorija (KategorijaID VARCHAR(10) NOT NULL PRIMARY KEY, NazivKategorije VARCHAR(15) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m242_dobavitelj (DobaviteljID VARCHAR(18) NOT NULL PRIMARY KEY, Ime VARCHAR(15) NOT NULL, Naslov VARCHAR(30), Posta VARCHAR(12) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m242_artikel (ArtikelID VARCHAR(8) NOT NULL PRIMARY KEY, DobaviteljID VARCHAR(18) NOT NULL, KategorijaID VARCHAR(10) NOT NULL, Naziv VARCHAR(15) NOT NULL, Enota VARCHAR(20), Cena DECIMAL(8,2) NOT NULL,
  FOREIGN KEY (DobaviteljID) REFERENCES m242_dobavitelj(DobaviteljID), FOREIGN KEY (KategorijaID) REFERENCES m242_kategorija(KategorijaID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m242_kategorija VALUES ('PEK','pekovski'),('MLE','mlečni'),('SAD','sadje');
INSERT INTO m242_dobavitelj VALUES ('D1','Pekarna Pečjak','Litijska 3','Ljubljana'),('D2','Žito','Šmartinska 154','Ljubljana'),('D3','Grosupeljčan','Taborska 2','Grosuplje'),('D4','Mlekarna Krepko','Cesta 1','Ljubljana');
INSERT INTO m242_artikel VALUES ('A1','D1','PEK','kruh','kos',1.90),('A2','D2','PEK','kruh','kos',2.10),('A3','D3','PEK','kruh','kos',1.70),('A4','D2','PEK','žemlja','kos',0.40),('A5','D4','MLE','mleko','l',1.10),('A6','D4','MLE','kruh','kos',2.00);

-- ---------- M242 · matura (naloga 20) ----------
CREATE TABLE m242_sola (SolaID INT NOT NULL PRIMARY KEY, imeSole VARCHAR(30) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m242_kandidat (EMSO CHAR(13) NOT NULL PRIMARY KEY, Ime VARCHAR(20) NOT NULL, Priimek VARCHAR(20) NOT NULL, SolaID INT, FOREIGN KEY (SolaID) REFERENCES m242_sola(SolaID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m242_predmet (PID INT NOT NULL PRIMARY KEY, imePredmeta VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m242_ocena (EMSO CHAR(13) NOT NULL, PID INT NOT NULL, tocke INT, PRIMARY KEY (EMSO, PID),
  FOREIGN KEY (EMSO) REFERENCES m242_kandidat(EMSO), FOREIGN KEY (PID) REFERENCES m242_predmet(PID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m242_sola VALUES (1,'Gimnazija Novo mesto'),(2,'SŠ Novo mesto'),(3,'Gimnazija Kočevje');
INSERT INTO m242_kandidat VALUES ('0101006500001','Neja','Smolič',1),('0202006500002','Bine','Kuhar',2),('0303006500003','Tea','Vrhovec',NULL),('0404006500004','Ožbe','Ajdič',2),
 ('0505006500005','Lun','Bratož',NULL),('0606006500006','Pika','Grabnar',1),('0707006500007','Svit','Rozina',2);
INSERT INTO m242_predmet VALUES (1,'matematika'),(2,'slovenščina'),(3,'računalništvo');
INSERT INTO m242_ocena VALUES ('0101006500001',1,240),('0101006500001',2,210),('0202006500002',1,190),('0202006500002',3,250),('0303006500003',1,175),('0303006500003',2,NULL),('0404006500004',3,230),
 ('0505006500005',2,205),('0505006500005',3,260),('0606006500006',1,270),('0707006500007',3,215);

-- ---------- M251 · prodaja ----------
CREATE TABLE m251_zaposlen (IDzaposlen INT NOT NULL PRIMARY KEY, ime VARCHAR(20) NOT NULL, priimek VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m251_izdelek (IDIzdelek INT NOT NULL PRIMARY KEY, imeIzdelka VARCHAR(20) NOT NULL, cena DECIMAL(8,2) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m251_stranka (IDStranka INT NOT NULL PRIMARY KEY, ime VARCHAR(20) NOT NULL, priimek VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m251_racun (IDRacun INT NOT NULL PRIMARY KEY, IDStranka INT NOT NULL, IDIzdelek INT NOT NULL, IDzaposlen INT NOT NULL, Datum DATE NOT NULL,
  FOREIGN KEY (IDStranka) REFERENCES m251_stranka(IDStranka), FOREIGN KEY (IDIzdelek) REFERENCES m251_izdelek(IDIzdelek), FOREIGN KEY (IDzaposlen) REFERENCES m251_zaposlen(IDzaposlen)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m251_zaposlen VALUES (1,'Kristina','Jaklič'),(2,'Benjamin','Šurla');
INSERT INTO m251_izdelek VALUES (1,'slušalke',39.90),(2,'polnilec',14.50),(3,'kabel USB-C',7.90),(4,'ovitek',12.00);
INSERT INTO m251_stranka VALUES (1,'Hana','Lesjak'),(2,'Rok','Zavrl'),(3,'Hana','Zupanc'),(4,'Tilen','Kerin'),(5,'Mira','Pavlin');
INSERT INTO m251_racun VALUES (1,1,1,1,'2024-02-28'),(2,1,3,1,'2024-03-05'),(3,2,2,2,'2024-03-11'),(4,2,3,2,'2024-03-11'),(5,2,4,1,'2024-03-30'),(6,3,1,1,'2024-04-01'),
 (7,4,2,2,'2024-03-31'),(8,1,4,2,'2024-05-15'),(9,3,3,1,'2023-03-20');

-- ---------- M252 · oddelki in dijaki ----------
CREATE TABLE m252_oddelek (oID INT NOT NULL PRIMARY KEY, imeRazrednika VARCHAR(20) NOT NULL, priimekRazrednika VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m252_dijak (dID INT NOT NULL PRIMARY KEY, ime VARCHAR(20) NOT NULL, priimek VARCHAR(20) NOT NULL, oID INT NOT NULL, datumRojstva DATE NOT NULL, FOREIGN KEY (oID) REFERENCES m252_oddelek(oID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m252_oddelek VALUES (1,'Miha','Novak'),(2,'Jana','Krek'),(3,'Miha','Kranjc');
INSERT INTO m252_dijak VALUES (1,'Zarja','Lipovec',1,'2007-05-14'),(2,'Matevž','Bojc',1,'2007-11-02'),(3,'Ajda','Čolnar',1,'2008-01-20'),(4,'Teo','Rupar',2,'2007-03-03'),
 (5,'Lia','Šega',2,'2007-12-12'),(6,'Bor','Ahlin',3,'2008-02-29'),(7,'Gaja','Merc',3,'2007-08-08'),(8,'Ian','Leskovar',1,'2007-07-07');

-- ---------- M261 · prijave na maturo ----------
CREATE TABLE m261_sola (SID INT NOT NULL PRIMARY KEY, imeSole VARCHAR(30) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m261_kandidat (ID INT NOT NULL PRIMARY KEY, ime VARCHAR(20) NOT NULL, priimek VARCHAR(30) NOT NULL, SID INT NOT NULL, FOREIGN KEY (SID) REFERENCES m261_sola(SID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m261_predmet (PID INT NOT NULL PRIMARY KEY, imePredmeta VARCHAR(20) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
CREATE TABLE m261_prijava (ID INT NOT NULL, PID INT NOT NULL, izpitniRok VARCHAR(20) NOT NULL, nivo VARCHAR(5), PRIMARY KEY (ID, PID, izpitniRok),
  FOREIGN KEY (ID) REFERENCES m261_kandidat(ID), FOREIGN KEY (PID) REFERENCES m261_predmet(PID)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_sl_0900_ai_ci;
INSERT INTO m261_sola VALUES (1,'MojaNajŠola'),(2,'Gimnazija Bežigrad'),(3,'ŠC Novo mesto');
INSERT INTO m261_kandidat VALUES (1,'Lan','Zorman',1),(2,'Ela','Bratuša',1),(3,'Nik','Ažman',2),(4,'Neža','Šemrl',1),(5,'Maks','Furlan',3),(6,'Ana','Bratuša',1);
INSERT INTO m261_predmet VALUES (1,'matematika'),(2,'slovenščina'),(3,'angleščina'),(4,'računalništvo'),(5,'fizika');
INSERT INTO m261_prijava VALUES (1,1,'spomladanski','OR'),(1,2,'spomladanski',NULL),(1,4,'spomladanski',NULL),(2,1,'spomladanski','VR'),(2,3,'spomladanski','VR'),
 (3,1,'spomladanski','OR'),(3,4,'spomladanski',NULL),(4,2,'spomladanski',NULL),(5,4,'spomladanski',NULL),(5,1,'jesenski','OR'),(6,3,'spomladanski','OR'),(3,1,'jesenski','OR');
