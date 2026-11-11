/* A task for the RAID page (10. 11. 2026): rebuild the disk that failed. It sits in set D (Pariteta). */
{
  const d = ["11001010", "10010110", "01110001"], P = xorS(xorS(d[0], d[1]), d[2]);
  add(3, 2, {
    t: "num", fixed: 1, ans: d[1], lab: "Obnovljeni Disk 2 (8 bitov)",
    fig: al([{ l: "Disk 1", s: d[0] }, { l: "Disk 2", s: "????????" }, { l: "Disk 3", s: d[2], ln: true }, { l: "Disk P", s: P }]),
    q: "**Sistem RAID 5** ima tri diske s podatki in **paritetni disk P**. Paritetni disk je izbran tako, da je v vsakem stolpcu število enic na vseh štirih diskih **sodo**.\n**Disk 2** je odpovedal. Iz preostalih diskov obnovi njegovih **8 bitov**.",
    h: ["V vsakem stolpcu je število enic na vseh štirih diskih sodo. Če manjka en bit, ga dopolniš do sodega števila enic.",
      `Računaj stolpec za stolpcem: Disk 1 XOR Disk 3 XOR Disk P. V prvem stolpcu je ${d[0][0]} XOR ${d[2][0]} XOR ${P[0]} = ${d[1][0]}.`],
    sol: `<p>Vsak bit Diska 2 je XOR istoležnih bitov preostalih treh diskov:</p>${al([{ l: "Disk 1", s: d[0] }, { l: "Disk 3", s: d[2] }, { l: "Disk P", s: P, ln: true }, { l: "XOR = Disk 2", s: d[1], k: "res" }])}<p>Prvi stolpec: ${d[0][0]} XOR ${d[2][0]} XOR ${P[0]} = ${d[1][0]}. Tako dobiš vseh osem bitov: <b>${d[1]}</b>.</p>`
  });
}
