from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader

root = Path(__file__).resolve().parents[2]
out = root / 'output/pdf'
out.mkdir(parents=True, exist_ok=True)
for name, file in [('Noto', 'NotoSans-Regular.ttf'), ('NotoBold', 'NotoSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(root / 'renderer/assets/fonts' / file)))
c = canvas.Canvas(str(out / 'oferta-redesign-podglad.pdf'), pagesize=(595.276, 841.89))
c.setTitle('Podgląd nowego układu oferty ESUS')
ink, muted, blue, line = map(HexColor, ['#202C3B', '#627083', '#007BCE', '#DFE5EC'])
def txt(x, y, text, size=9, bold=False, color=ink, right=False):
    c.setFont('NotoBold' if bold else 'Noto', size)
    c.setFillColor(color)
    (c.drawRightString if right else c.drawString)(x, y, text)
def rule(y, x=42, end=553):
    c.setStrokeColor(line); c.setLineWidth(.6); c.line(x,y,end,y)

logo=ImageReader(str(root/'renderer/assets/logo_1_big.png'))
w,h=logo.getSize()
c.drawImage(logo,42,752,width=126,height=126*h/w,mask='auto')
txt(553,789,'OFERTA HANDLOWA',8,color=muted,right=True)
txt(553,764,'04/MB/10/2026',19,True,right=True)
txt(553,747,'Wersja z dnia 05.10.2026',8,color=muted,right=True)
rule(730)
txt(42,701,'Sprzęt sieciowy',22,True)
txt(42,682,'Oferta dla Dynpap Sp. z o.o.',10,color=muted)

txt(42,649,'KLIENT',8,True,muted)
txt(328,649,'PRZYGOTOWAŁ',8,True,muted)
txt(42,630,'Dynpap Sp. z o.o.',11,True)
txt(328,630,'Mateusz Barański',11,True)
for y, left, right in [(613,'ul. Ofiar Grudnia 1970 r. 13','mbaranski@esus-it.com'),(598,'71-642 Szczecin','tel. 600 674 356'),(583,'NIP: 9552215571','ESUS IT'),(568,'rafal.poleka@dynpap.pl','')]:
    txt(42,y,left,9,color=muted);txt(328,y,right,9,color=muted)

style=ParagraphStyle('product',fontName='Noto',fontSize=9,leading=13,textColor=ink)
head=ParagraphStyle('header',fontName='NotoBold',fontSize=7.5,leading=10,textColor=muted)
rows=[[Paragraph(t,head) for t in ['Produkt','Ilość','Cena netto/szt.<br/>po rabacie','Rabat','VAT','Wartość<br/>brutto']]]
rows += [
 [Paragraph('Antena Ubiquiti UBB',style),'1','2 381,77 zł','0%','23%','2 929,58 zł'],
 [Paragraph('Switch Ubiquiti USW-24-POE',style),'1','1 494,76 zł','1,2%','23%','1 838,55 zł'],
 [Paragraph('Access Point Ubiquiti U6+<br/><font color="#627083">2,4 / 5 GHz · Wi-Fi 6 (802.11ax)</font>',style),'4','436,63 zł','3%','23%','2 148,20 zł'],
]
t=Table(rows,colWidths=[197,42,84,43,35,110])
t.setStyle(TableStyle([('FONTNAME',(0,0),(-1,-1),'Noto'),('FONTSIZE',(0,1),(-1,-1),8.5),('TEXTCOLOR',(0,0),(-1,-1),ink),('BACKGROUND',(0,0),(-1,0),HexColor('#F1F4F7')),('ALIGN',(1,1),(-1,-1),'RIGHT'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),12),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('LINEBELOW',(0,0),(-1,-1),.5,line)]))
tw,th=t.wrap(511,300);t.drawOn(c,42,540-th)
base=540-th-24
txt(338,base,'Produkty netto',9,color=muted);txt(543,base,'5 623,03 zł',10,right=True)
txt(338,base-20,'VAT produktów (23%)',9,color=muted);txt(543,base-20,'1 293,30 zł',10,right=True)
txt(338,base-40,'Dostawa brutto',9,color=muted);txt(543,base-40,'20,00 zł',10,right=True)
c.setFillColor(HexColor('#EAF4FC'));c.rect(328,base-100,225,43,fill=1,stroke=0)
txt(338,base-82,'Łącznie brutto',10,True)
txt(543,base-82,'6 936,33 zł',17,True,blue,True)

txt(42,base,'WARUNKI OFERTY',8,True,muted)
for dy,label,value_ in [(22,'Płatność','Przedpłata'),(43,'Realizacja','4–5 dni roboczych'),(64,'Ważna do','5 października 2026'),(85,'Dostawa','Przesyłka kurierska')]:
    txt(42,base-dy,label,8.5,color=muted);txt(113,base-dy,value_,8.5,bold=label=='Ważna do')

rule(90)
txt(42,73,'ESUS IT Sp. z o.o. · ul. Somosierry 30A · 71-181 Szczecin',7.4,color=muted)
txt(42,60,'NIP: PL8522690002 · KRS: 0001012470 · REGON: 524134686',7,color=muted)
txt(42,47,'Sąd Rejonowy w Szczecinie, VII Wydział Gospodarczy KRS · Kapitał zakładowy: 5 000 zł',6.7,color=muted)
txt(553,60,'04/MB/10/2026',7,color=muted,right=True)
txt(553,47,'1 / 1',7,color=muted,right=True)
c.save()
print(out/'oferta-redesign-podglad.pdf')
