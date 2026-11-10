/* Introduction to the symbols: the IEC symbols used in this material next to the ANSI/IEEE ones found in many textbooks. */
WIDGETS.symcmp = h=>{
  const list = ["AND","OR","NOT","NAND","NOR","XOR","XNOR"];
  h.innerHTML = `<div class="wbox"><div class="tbl"><table class="eqtab symcmp"><thead><tr><th>Vrata</th><th>IEC<br><small>uporabljamo v tem gradivu</small></th><th>ANSI/IEEE<br><small>srečaš v učbenikih in na spletu</small></th></tr></thead>
    <tbody>${list.map(t=>`<tr><td>${GM[t][0]} (${t})</td><td>${gateSvg(t,"gsvg sm")}</td><td>${gateSvgAnsi(t,"gsvg sm")}</td></tr>`).join("")}</tbody></table></div>
    <p class="wnote">Oba sistema pomenita isto: krožec na izhodu je negacija, oblika ali oznaka pa pove vrsto vrat. V tem gradivu, v nalogah in v vezjih so vedno simboli IEC.</p></div>`;
};
