# API Documentation (Converted from PDF)

Get  Wallet Balance
 
R etriev e yo u r curr en t wallet balan c e to  ch eck ava ilabl e f u n ds f o r p lacin g o rd ers .
 
Endpo int
 
GET /v 1/ del ive ry
-
pa rt ner s/ {dp ID }/w all e t/b ala nc e
 
 
Headers
 
H e ad e r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
x
-
clien t
-
id
 
S trin g
 
Yo u r clien tI D
 


 
Yes
 
x
-
clien t
-
secr et
 
S trin g
 
Yo u r clien tS ecret
 


 
Yes
 
Path Par ameter s
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
dpID
 
S trin g
 
Yo u rd elivery p artner I D
 


 
Yes
 
Exa mpl e R eq uest
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /de li ver y
-
par tne r s/Y OUR _D P_I D/w al let /b ala nc e
'
 
\
 


  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 
R espo nse
 
Suc c essf ul R esponse
 
{
 
  
" bal an ce"
: 
9 00 00
,
 
  
" cur re ncy "
: 
"I NR"
 
}
 
 
R esponse F i elds
 
F ie ld
 
T y pe
 
D e sc ript ion
 
balance
 
N u mber
 
Cu rr en t wallet balan c e
 
currenc y
 
S trin g
 
Cu rr en cy co d e (typ ically "I N R ")
 
B al ance Mo nitoring
 
R ea l
-
ti me B a la nc e Chec k s
 
// Exa mp le: Ch ec kb al anc e bef or ep lac i ng ord er
 
asy nc
 
fu nct ion
 
c hec kB ala nc eBe fo reO rde r
(or der Am oun t) {
 
  
t ry
 
{
 
  
co ns t
 
r esp on se = 
awa it
 
fe tc h
(
 
  
`
$ {ba seU rl }
/v 1/ del iv ery
-
p art ner s /
${ dpI D}
/wa lle t/ bal an ce`
,
 
  
{
 


    
hea der s
: {
 
    
'x
-
c li ent
-
i d'
: c lie nt Id,
 
    
'x
-
c li ent
-
s ecr et '
: cl ien tSe c ret
 
   
}
 
  
}
 
  
);
 
 
  
co ns t
 
w all et Dat a = 
a wa it
 
re spo nse .
jso n
() ;
 
  
 
   
if
 
(w all etD at a.b al anc e >= or der Amo u nt) {
 
  
co nso le.
lo g
(
' Su ffi ci ent b ala nce  ava ila bl e'
);
 
  
re tur n
 
t ru e
;
 
  
} 
el se
 
{
 
  
co nso le.
wa rn
(
`I nsu ff ici en tb ala n ce. Av ai lab le:  
${w all et Dat a.b al anc e}
,R eq uir ed : 
$ {or d erA mou nt }
`
);
 
  
re tur n
 
f al se
;
 
  
}
 
  
} 
ca tc h
 
( err or ){
 
  
co ns ole .
er ro r
(
' Er ror c hec ki ng wal l et bal an ce: '
, er ror );
 
  
th ro w
 
e rro r;
 
  
}
 
}
 
 
Ba la nc e A lerts
 
// Exa mp le: Se t up ba lan ce mo ni tor ing
 
asy nc
 
fu nct ion
 
m oni to rBa la nce
(m ini mum T hre sho ld = 
100 00
) {
 
  
c ons t
 
wal let Da ta = 
awa it
 
ge tW all etB a lan ce
( );
 
  
 
 
if
 
(w al let Dat a. bal an ce < min im umT hre s hol d) {
 
  
// S end al er tt o adm in
 
  
aw ai t
 
s end Lo wBa la nce Al ert
({
 
  
cu rre ntB al anc e
: wa ll etD at a.b ala n ce,
 
  
th res hol d
: mi ni mum Th res ho ld,
 
  
cu rre ncy
: wal le tDa ta .cu rr enc y
 
  
}) ;
 
  
}
 


}
 
 
Erro rR espo nses
 
U na uthori z ed A c c ess
 
{
 
  
"e rr or"
: 
" un aut he nti ca ted "
,
 
  
"e rr Cod e"
: 
" UNA UT HOR IZ ED"
 
}
 
 
Inva li d D P ID
 
{
 
  
"e rr or"
: 
" fo rbi dd en: p ara m: ad min  use rd oe sn ot ha ve ac ces s to DP : 
INV ALI D_ DP_ ID"
,
 
  
"e rr Cod e"
: 
" FOR BI DDE N"
 
}
 
 
Use Cases
 
1 .  Pre
-
order V a li da ti on
 
Ch eck balan ce b ef o re allo win g  cus to mers to p lace o rd ers .
 
2 .  Da shb oa rdD i spla y
 
S h o w cu rr en t balan ce o n  ad min d as h bo ard s .
 


3 .  L ow  B a la nc e A lerts
 
Mo n ito r balan ce an d  alert wh en  fu n ds  are run n ing  lo w.
 
4 .  F i na nci a l R eporti ng
 
I n clu d e balan ce in f o rm atio n  in f in an cial rep o rts .
 
B est Practices
 
1.
 
C h ec k Be f ore  Ord e rs
: Always  verif y su ff icien t ba lan ce bef o re p lacin g  o rd ers
 
2.
 
C a ch e Wise ly
:  Balan ce ch an g es  frequ en tly,  s o cach e fo r sho rt p erio ds o n ly
 
3.
 
H a nd le  E rrors
: I mp lemen t p ro p er erro rh an d lin g f or balan ce ch ecks
 
4.
 
M onit or R e gu l a rly
: S et u p au to mated  balan ce mo n ito rin g
 
5.
 
Al e rt T h re sh ol d s
: Co nf ig u re lo w balan ce alerts  f o r you r bu s in es s n eed s
 
I ntegration Patterns
 
Pre
-
orde r Ba la nc e Chec k
 
// Rec om men ded p att er n: Ch eck b ala nce  bef ore o rde r
 
asy nc
 
fu nct ion
 
p lac eO rde rW ith Ba lan ceC h eck
(or de rDa ta) {
 
  
/ /1 . Cal cul at eo rd er to tal
 
  
c ons t
 
ord erT ot al = 
cal cu lat eO rde rTo t al
( ord er Dat a);
 
  
 
 
// 2. C hec kw al let b ala nc e
 
  
c ons t
 
has Bal an ce = 
awa it
 
ch ec kBa lan c eBe for eO rde r
(o rd erT ot al) ;
 
  
 
 
if
 
(! ha sBa lan ce ){
 
  
th ro w
 
n ew
 
Er ror (
' Ins uf fic ie nt wal l et bal an ce'
);
 
  
}
 
  
 
 
// 3. P lac eo rd er
 
  
r etu rn
 
aw ait
 
p lac eO rde r
( ord er Dat a);
 


}
 
 
Ba la nc e M oni tori ng S ervi c e
 
// Exa mp le: Ba ck gro un db al anc e mon ito r ing
 
cla ss
 
Wa lle tMo ni tor {
 
  
c ons tr uct or
( dp ID, c lie nt Id, c lie ntS e cre t, th res hol ds ){
 
  
th is
.dp ID = dpI D;
 
  
th is
.cl ien tI d= c lie nt Id;
 
  
th is
.cl ien tS ecr et = cl ien tS ecr et;
 
  
th is
.th res ho lds = th re sho ld s;
 
  
}
 
  
 
 
as ync
 
s tar tMo ni tor in g
(i nt erv al Min ute s = 
30
) {
 
  
se tI nte rva l
(
asy nc
 
() = >{
 
  
tr y
 
{
 
   
con st
 
ba lan ce = 
aw ait
 
t his
.
ge t Bal anc e
( );
 
   
awa it
 
th is
.
ch eck Th res ho lds
(ba l anc e);
 
  
} 
cat ch
 
(e rro r) {
 
   
con sol e.
err or
(
'B al anc e mon ito r ing er ro r:'
,e rr or) ;
 
  
}
 
  
}, i nte rva lM inu te s*  
60
 
* 
1 000
);
 
  
}
 
  
 
 
as ync
 
g etB ala nc e
() {
 
  
co ns t
 
r esp on se = 
awa it
 
fe tc h
(
 
  
`
$ {ba seU rl }
/v 1/ del iv ery
-
p art ner s /
${
thi s
. dpI D}
/ wa lle t/ bal an ce`
,
 
  
{
 
   
hea der s
: {
 
    
'x
-
c li ent
-
i d'
: 
t his
.c lie ntI d ,
 
    
'x
-
c li ent
-
s ecr et '
: 
th is
. cli e ntS ecr et
 
   
}
 
  
}
 
  
);
 
  
 
   
ret ur n
 
a wai t
 
res po nse .
j son
() ;
 
  
}
 


  
 
 
as ync
 
c hec kTh re sho ld s
(w al let Da ta) {
 
  
co ns t
 
{ ba la nce } = wa lle tD ata ;
 
  
 
   
if
 
(b ala nce <  
th is
.th re sho ld s.c rit i cal ){
 
  
aw ait
 
th is
.
se nd Ale rt
(
'C RI TIC AL'
, ba lan ce );
 
  
} 
el se
 
if
 
(b ala nc e<  
t his
.t hre sho l ds. war ni ng) {
 
  
aw ait
 
th is
.
se nd Ale rt
(
'W AR NIN G'
,  bal anc e) ;
 
  
}
 
  
}
 
}
 
 
 
 
Get  Wallet Transact ion 
History
 
R etriev e yo u r wallet tran s actio n  h is to ry with  op tio n al f ilterin g  by tran s actio n  typ e.
 
Endpo int
 
GET /v 1/ del ive ry
-
pa rt ner s/ {dp ID }/w all e t/t ran sa cti ons
 
 
Headers
 
H e ad e r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
x
-
clien t
-
id
 
S trin g
 
Yo u r clien tI D
 


 
Yes
 


x
-
clien t
-
secr et
 
S trin g
 
Yo u r clien tS ecret
 


 
Yes
 
Path Par ameter s
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
dpID
 
S trin g
 
Yo u rd elivery p artner I D
 


 
Yes
 
QueryPara meters
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire
d
 
Op t ions
 
txnType
 
S trin g
 
F ilter by tran s actio n  typ e
 
0
 
No
 
CREDIT
, 
DEBI T
 
nextCur sor
 
S trin g
 
Pag in at io n  cu rso r
 
0
 
No
 
-
 
limit
 
I n teg er
 
R eco rd s p er p ag e
 
0
 
No
 
D ef au lt:  15 ,  Max: 1 00
 
Transact ion Types
 
T y pe
 
D e sc ript ion
 
CREDIT
 
Mo n ey is  cred ited  in to  th e wallet
 
DEBIT
 
Mo n ey is  d ebited  f ro m th e wallet
 


Exa mpl e R eq uests
 
G et A ll Tra nsa c ti ons
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /de li ver y
-
par tne rs /YO UR_ DP _ID /w all et /tr an sac tio n s
'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 
G et Only D eb i t Tra nsa c ti ons
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /de li ver y
-
par tne rs /YO UR_ DP _ID /w all et /tr an sac tio n s
'
 
\
 
  
--
da ta
-
ur len co de 
't xnT yp e=D EB IT'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 
G et Tra nsa c ti ons w i th Pa gi na tion
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /de li ver y
-
par tne rs /YO UR_ DP _ID /w all et /tr an sac tio n s
'
 
\
 
  
--
da ta
-
ur len co de 
'l imi t= {li mi t}'
 
\
 
  
--
da ta
-
ur len co de 
'n ext Cu rso r= {ne xtC u rso r}'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 


R espo nse
 
Suc c essf ul R esponse
 
{
 
  
" tra ns act ion s"
: [
 
  
{
 
  
"t xnI D"
: 
" 615 26 1b6
-
c af9
-
4 2e0
-
aa 7 b
-
4 bec af 54a 289
-
175 558 31 533 431 28 244 "
,
 
  
"d pID "
: 
"6 152 61 b6
-
ca f9
-
42 e0
-
aa7 b
-
4b eca f5 4a2 89"
,
 
  
"t xnT ype "
: 
"D EB IT"
,
 
  
"c urr enc y"
: 
" IN R"
,
 
  
"a mou nt"
: 
95
,
 
  
"b ala nce Be for e"
: 
7 11 99. 66
,
 
  
"b ala nce Af ter "
: 
71 10 4.6 6
,
 
  
"s our ceS ys tem "
: 
"E XL R8_ B2 B_S TOR E "
,
 
  
"a cti vit y"
: 
" PU RCH AS E"
,
 
  
"r efe ren ce ID"
: 
"OR DI N19 08 202 58b 9 c48 b"
,
 
  
"r efe ren ce Typ e"
: 
" PU RCH AS E"
,
 
  
"m eta dat a"
: {
 
   
"co mme nt "
: 
"S yst em Tr an sac tio n :M one y DEB ITE D aga in st Or der "
 
  
},
 
  
"c rea ted At "
: 
"2 025
-
08
-
1 9T 05: 59: 1 3.3 43Z "
,
 
  
"u pda ted At "
: 
"2 025
-
08
-
1 9T 05: 59: 1 3.3 43Z "
 
  
}
 
  
],
 
  
" pag in ati onI nf o"
: {
 
  
"n ex tCu rso r"
: 
" 68 a15 87 2f1 ed 13b fd8 9 2c1 23"
,
 
  
"h as Mor e"
: 
t rue
 
  
}
 
}
 
 


R espo nse Fields
 
Tra nsa c ti on F i elds
 
F ie ld
 
T y pe
 
D e sc ript ion
 
txnID
 
S trin g
 
Uniqu e tran s actio n  id en tif ier
 
dpID
 
S trin g
 
Yo u rd elivery p artner I D
 
txnType
 
S trin g
 
Tran s actio n  typ e (CR E D I T/ D E BI T)
 
currenc y
 
S trin g
 
Cu rr en cy co d e
 
amount
 
N u mber
 
Tran s actio n  amo u n t
 
balance Before
 
N u mber
 
Wallet b alan c e bef o re tran s actio n
 
balance After
 
N u mber
 
Wallet b alan c e af ter tran s actio n
 
sourceS ystem
 
S trin g
 
S ys tem th at in itiat ed  th e tran s actio n
 
activit y
 
S trin g
 
Activit y typ e (s ee Activ ity Typ es  belo w)
 
referen ceID
 
S trin g
 
R ef eren ce to  related  en tity ( Ord er I D ,  UTR ,  etc. )
 
referen ceType
 
S trin g
 
Typ e o f  ref eren ce
 
metadat a
 
Obj ect
 
Ad d itio n al tran s actio n  d etails
 
created At
 
S trin g
 
Tran s actio n  times tamp
 
updated At
 
S trin g
 
L as t u pd ate times tamp
 


Transact ion A ctivity T ypes
 
Ac t iv ity
 
D e sc ript ion
 
R e fe re nc e T yp e
 
TOPUP
 
Wallet to p p ed  u p man u ally
 
UTR  (ban k ref eren ce )
 
PURCHAS E
 
Pu rch as e mad e f ro m wallet
 
Ord er I D
 
REFUND
 
Mo n ey ref u nd ed  ag ain s t an o rd er
 
Ord er I D
 
ADJUST
 
Man u al wallet ad j u s tmen t
 
Tran s actio n  I D
 
Fil tering Exa mpl es
 
G et R ec ent Purc ha ses
 
// Exa mp le: Ge t rec en tp ur cha se tr ans a cti ons
 
asy nc
 
fu nct ion
 
g etR ec ent Pu rch as es
( lim i t=  
50
) {
 
  
c ons t
 
res pon se = 
aw ait
 
f etc h
(
 
  
`
$ {b ase Url }
/ v1/ de liv er y
-
par tne rs /
${ dpI D}
/wa ll et/ tr ans ac tio ns? t xnT ype =D EBI T&l im it=
${ lim it }
`
,
 
  
{
 
  
he ade rs
: {
 
   
'x
-
cli en t
-
i d'
:c li ent Id ,
 
   
'x
-
cli en t
-
s ec ret '
: cl ie ntS ecr e t
 
  
}
 
  
}
 
  
);
 
  
 
 
co nst
 
d ata = 
aw ait
 
r esp on se.
js on
( );
 
  
 
 
// Fi lt er onl y pur ch ase a cti vi tie s
 
  
r etu rn
 
da ta. tr ans ac tio ns .
fi lt er
( txn  => txn .a cti vit y ===  
' PUR CH ASE '
);
 


}
 
 
G et Top
-
ups Only
 
// Exa mp le: Ge t wal le tt op
-
up h ist ory
 
asy nc
 
fu nct ion
 
g etT op upH is tor y
( ){
 
  
c ons t
 
res pon se = 
aw ait
 
f etc h
(
 
  
`
$ {b ase Url }
/ v1/ de liv er y
-
par tne rs /
${ dpI D}
/wa ll et/ tr ans ac tio ns? t xnT ype =C RED IT`
,
 
  
{
 
  
he ade rs
: {
 
   
'x
-
cli en t
-
i d'
:c li ent Id ,
 
   
'x
-
cli en t
-
s ec ret '
: cl ie ntS ecr e t
 
  
}
 
  
}
 
  
);
 
  
 
 
co nst
 
d ata = 
aw ait
 
r esp on se.
js on
( );
 
  
 
 
// Fi lt er onl y top
-
u pa ct ivi ti es
 
  
r etu rn
 
da ta. tr ans ac tio ns .
fi lt er
( txn  => txn .a cti vit y ===  
' TOP UP '
);
 
}
 
 
Erro rR espo nses
 
U na uthori z ed A c c ess
 
{
 
  
"e rr or"
: 
" un aut he nti ca ted "
,
 
  
"e rr Cod e"
: 
" UNA UT HOR IZ ED"
 
}
 
 


Inva li d D P ID
 
{
 
  
"e rr or"
: 
" fo rbi dd en: p ara m: ad min  use rd oe sn ot ha ve ac ces s to DP : 
INV ALI D_ DP_ ID"
,
 
  
"e rr Cod e"
: 
" FOR BI DDE N"
 
}
 
 
Inva li d Tra nsa c ti on Type
 
{
 
  
" err or "
: 
"In va lid t ran sa cti on ty pe"
,
 
  
" err Co de"
: 
" BA D_R EQ UES T"
 
}
 
 
Use Cases
 
1 .  F i na nci a l R ec onci li a ti on
 
Match  tran s actio n s  with  yo ur in tern al acco u n tin g s ys tems .
 
2 .  A udi t Trai l
 
Main ta in  co mp lete au d it trails  f o r co mp lian ce.
 
3 .  S pendi ng A na lysi s
 
An alyz e s p en d in g p attern s  an d o p timiz e p u rch as in g .
 


4 .  Customer Support
 
Pro vid e tran s actio n  d etails  f o r cu s to mer in qu iries .
 
B est Practices
 
1.
 
R e gu la r Re c onc il ia t ion
: R eg u larly reco n cile trans actio n s  with  you r record s
 
2.
 
F il te r Ap p rop riat e ly
: Us e tran s actio n  typ e f ilters to  redu ce d ata tran s f er
 
3.
 
H a nd le P a ginat ion
: I mp lemen t p ro p er p ag in ation  fo r larg e tran s actio n h is to ries
 
4.
 
S t ore R e fe re nc e s
:  Map  tran s actio n  ref eren ces  to yo u r in tern al s ys tems
 
5.
 
M onit or P at te rns
:  Watch f o r u nu su al tran s actio n  p attern s
 
I ntegration Exa mpl e
 
// Exa mp le: Co mp let e tra ns act io nm oni t ori ng
 
cla ss
 
Tr ans act io nMo ni tor {
 
  
a syn c
 
get Tra ns act io nSu mm ary
(d ays = 
30
) {
 
  
co ns t
 
t ran sa cti on s=  
a wai t
 
thi s
.
g e tTr ans ac tio nsF or Per io d
(d ay s);
 
  
 
   
con st
 
su mma ry = {
 
  
to tal Cre di ts
: 
0
,
 
  
to tal Deb it s
: 
0
,
 
  
pu rch ase Co unt
: 
0
,
 
  
re fun dCo un t
: 
0
,
 
  
to pup Cou nt
: 
0
 
  
};
 
  
 
   
tra ns act ion s.
for Ea ch
( tx n= > {
 
  
if
 
(t xn. tx nTy pe == = 
'CR ED IT'
) {
 
   
sum mar y. tot al Cre di ts += tx n.a m oun t;
 
   
if
 
(tx n. act iv ity = == 
'T OPU P'
)  sum mar y. top upC ou nt+ +;
 
   
if
 
(tx n. act iv ity = == 
'R EFU ND'
) su mma ry .re fun dC oun t+ +;
 
  
} 
els e
 
if
 
(tx n. txn Ty pe == = 
' DEB I T'
) {
 
   
sum mar y. tot al Deb it s+ = txn .am o unt ;
 
   
if
 
(tx n. act iv ity = == 
'P URC HAS E '
) sum ma ry. pur ch ase Co unt ++ ;
 


   
}
 
  
}) ;
 
  
 
   
ret ur n
 
s umm ar y;
 
  
}
 
  
 
 
as ync
 
r eco nci le Wit hO rde rs
() {
 
  
co ns t
 
p urc ha ses =  
aw ai t
 
t hi s
.
g etP u rch ase Tr ans act io ns
( );
 
  
co ns t
 
o rde rs = 
aw ait
 
t his
.
g etO rde r s
() ;
 
  
 
   
// Ma tch tr an sac ti ons w ith o rde rs
 
  
co ns t
 
r eco nc ili at ion = pu rc has es.
m ap
( txn = >{
 
  
co nst
 
or de r= o rde rs .
fi nd
(o => o .or der ID == =t xn .re fe ren ce ID) ;
 
  
re tur n
 
{
 
   
tra nsa ct ion
: txn ,
 
   
ord er
: o rde r,
 
   
mat che d
: !! or der ,
 
   
dis cre pa ncy
: ord er ? Ma th.
abs
( ord er. to tal Amo un t 
-
 
txn .am ou nt) : 
nu ll
 
  
};
 
  
}) ;
 
  
 
   
ret ur n
 
r eco nc ili at ion ;
 
  
}
 
}
 
Get  A vailabl e P roduct s
 
R etriev e a lis t o f p rod u cts an d  varian ts  availabl e f o ro rd erin g , with  p ag in atio n  su p po rt.
 
Endpo int
 
GET /v 1/ pro duc ts /de li ver y
-
par tn ers /{d p ID}
 
 


Headers
 
H e ad e r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
x
-
clien t
-
id
 
S trin g
 
Yo u r clien tI D
 


 
Yes
 
x
-
clien t
-
secr et
 
S trin g
 
Yo u r clien tS ecret
 


 
Yes
 
Path Par ameter s
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
dpID
 
S trin g
 
Yo u rd elivery p artner I D
 


 
Yes
 
QueryPara meters
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire
d
 
D e f au l t
 
nextCur sor
 
S trin g
 
Pag in at io n  cu rso r fo r n ext p ag e
 
0
 
No
 
-
 
limit
 
I n teg er
 
N u mber of  reco rd s p er p ag e
 
0
 
No
 
15
 
P AGI N AT I ON LI MI T S
 

 
D e f au l t l im it
: 1 5 reco rds  p er p ag e
 

 
M a xim u m l im it
: 1 0 0 reco rd s p er p ag e
 


Exa mpl e R eq uest
 
G et A ll Produc ts (F i rst Pa ge)
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /pr od uct s/ del ive r y
-
p art ne rs/ YOU R_ DP_ ID
'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 
G et Produc ts w i th Pa gi na ti on
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /pr od uct s/ del ive r y
-
p art ne rs/ YOU R_ DP_ ID
'
 
\
 
  
--
da ta
-
ur len co de 
'l imi t= {li mi t}'
 
\
 
  
--
da ta
-
ur len co de 
'n ext Cu rso r= {ne xtC u rso r}'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 
R espo nse
 
Suc c essf ul R esponse
 
{
 
  
" pro du cts "
: [
 
  
{
 
  
"p rod uct ID "
: 
"P ROD
-
c d25 0a 2a
-
2b2 7
-
40 e0"
,
 
  
"a tta chm en ts"
: [
 
   
"
ht tps :/ /st or age .g oog le api s.c o m/e xlr 8
-
ass ets /0 e6f ff dd
-
67 e7
-
41f 1
-
b f8 7
-
1 2ad c5 97d 4c b/i ma ges /p rod uct s /de fau lt _vo uch er .jp g
"
 
  
],
 
  
"c ate gor ie s"
: [
 
   
{
 


     
" cat eg ory ID "
: 
"C AT
-
e0 bc0 1c8
-
a9b 2
-
4 d3 a"
,
 
    
" cat eg ory Na me"
: 
"Ga mi ng"
 
   
}
 
  
],
 
  
"d esc rip ti onT ex t"
: 
" Get t his vo u che rf or in sta nt sa vi ngs o ny ou r 
nex tp ur cha se. S imp ly re de em it at th e ti me of ch eck ou tt o app ly th e 
dis cou nt .I t's t he pe rfe ct wa y to mak e yo ur mo ney go f urt he r"
,
 
  
"p rod uct Di spl ay Nam e"
: 
" TE ST_ PRO D UCT _1_ DP _AP IS"
,
 
  
"p rod uct Na me"
: 
"TE ST _PR OD UCT _1_ D P_A PIS "
,
 
  
"r ede mpt io nIn st ruc ti ons "
: 
"T or e dee my ou rv ouc he r, fo llo w the se  
ste ps:
\
n
\
nC lic k on th eu ni que r ede mpt i on URL p rov ide d in yo ur em ail o r 
on the v ouc her p age .
\
n
\
n Ad dy ou rd esi r ed pro du cts to t he ca rt on th e 
par tne r' sw ebs it e.
\
n
\
nTh e dis co unt wi l lb ea ut oma tic al ly ap pli ed at  
che cko ut , 
o ry ou ma y nee d to en ter a u niq ue co de fou nd on y our  
vou che r.
\
n
\
nCo mp let e you r pur ch ase an d en joy y our sa vi ngs !"
,
 
  
"t erm sAn dC ond it ion s"
: 
" Th is vou c her is v ali df or on e
-
tim e use  
onl y. 2. It ca nn ot be co mb ine d wit ha n yo the r off ers , dis co unt s, or  
pro mot io ns. 3. T his v ouc he ri s non
-
re f und abl e and ca nn ot be ex ch ang ed  
for ca sh .4 .T he vo uc her i sv al id unt i li ts st ate de xp ira ti on da te. 5 . 
Los t, s
t ole n, or da ma ged v ouc he rs wil l no tb e rep lac ed .6 . The  
mer cha nt re ser ve st he ri gh tt o mod ify  the se te rms an d con di tio ns at  
any ti me wi tho ut pr io rn ot ice "
,
 
  
"v ari ant s"
: [
 
   
{
 
    
" var ia ntI D"
: 
" VA R
-
2 3c 2a4 75
-
0 6cb
-
41 18 "
,
 
    
" var ia ntN am e"
: 
" TES T_ PRO DUC T _1_ DP_ AP IS INR 1 00"
,
 
    
" var ia ntD is pla yN ame "
: 
Qhe e Q
,
 
    
" mrp "
: 
10 0
,
 
    
" pri ce "
: 
99
,
 
    
" mar gi n"
: 
1
,
 
    
" sto ck "
: 
99 9
 
   
}
 
  
]
 
  
},
 
  
{
 
  
"p rod uct ID "
: 
"P ROD
-
c f51 c2 4f
-
425 a
-
46 3b"
,
 
  
"a tta chm en ts"
: [
 
   
"
ht tps :/ /st or age .g oog le api s.c o m/e xlr 8
-
ass ets /0 e6f ff dd
-
67 e7
-
41f 1
-
b f8 7
-
1 2ad c5 97d 4c b/i ma ges /p rod uct s /de fau lt _vo uch er .jp g
"
 


   
],
 
  
"c ate gor ie s"
: [
 
   
{
 
    
" cat eg ory ID "
: 
"C AT
-
e0 bc0 1c8
-
a9b 2
-
4 d3 a"
,
 
    
" cat eg ory Na me"
: 
"Ga mi ng"
 
   
}
 
  
],
 
  
"d esc rip ti onT ex t"
: 
" Get t his vo u che rf or in sta nt sa vi ngs o ny ou r 
nex tp ur cha se. S imp ly re de em it at th e ti me of ch eck ou tt o app ly th e 
dis cou nt .I t's t he pe rfe ct wa y to mak e yo ur mo ney go f urt he r"
,
 
  
"p rod uct Di spl ay Nam e"
: 
" TE ST_ PRO D UCT _2_ DP _AP IS"
,
 
  
"p rod uct Na me"
: 
"TE ST _PR OD UCT _2_ D P_A PIS "
,
 
  
"r ede mpt io nIn st ruc ti ons "
: 
"T or e dee my ou rv ouc he r, fo llo w the se  
ste ps:
\
n
\
nC lic k on th eu ni que r ede mpt i on URL p rov ide d in yo ur em ail o r 
on the v ouc her p age .
\
n
\
n Ad dy ou rd esi r ed pro du cts to t he ca rt on th e 
par tne r' sw ebs it e.
\
n
\
nTh e dis co unt wi l lb ea ut oma tic al ly ap pli ed at  
che cko ut , 
o ry ou ma y nee d to en ter a u niq ue co de fou nd on y our  
vou che r.
\
n
\
nCo mp let e you r pur ch ase an d en joy y our sa vi ngs !"
,
 
  
"t erm sAn dC ond it ion s"
: 
" Th is vou c her is v ali df or on e
-
tim e use  
onl y. 2. It ca nn ot be co mb ine d wit ha n yo the r off ers , dis co unt s, or  
pro mot io ns. 3. T his v ouc he ri s non
-
re f und abl e and ca nn ot be ex ch ang ed  
for ca sh .4 .T he vo uc her i sv al id unt i li ts st ate de xp ira ti on da te. 5 . 
Los t, s
t ole n, or da ma ged v ouc he rs wil l no tb e rep lac ed .6 . The  
mer cha nt re ser ve st he ri gh tt o mod ify  the se te rms an d con di tio ns at  
any ti me wi tho ut pr io rn ot ice "
,
 
  
"v ari ant s"
: [
 
   
{
 
    
" var ia ntI D"
: 
" VA R
-
3 45 5a0 e1
-
4 7c8
-
4e 6f "
,
 
    
" var ia ntN am e"
: 
" TES T_ PRO DUC T _2_ DP_ AP IS INR 1 00"
,
 
    
" var ia ntD is pla yN ame "
: 
Qhe e Q
,
 
    
" mrp "
: 
10 0
,
 
    
" pri ce "
: 
99
,
 
    
" mar gi n"
: 
1
,
 
    
" sto ck "
: 
39 99
 
   
}
 
  
]
 
  
}
 
  
],
 
  
" pag in ati onI nf o"
: {
 


   
"n ex tCu rso r"
: 
""
,
 
  
"h as Mor e"
: 
f als e
 
  
}
 
}
 
 
R espo nse Fields
 
Produc t F i elds
 
F ie ld
 
T y pe
 
D e sc ript ion
 
product ID
 
S trin g
 
Uniqu e p ro du ct id en tif ier
 
product Name
 
S trin g
 
I n tern al p rod u ct n ame
 
product Displa yName
 
S trin g
 
D is p lay n ame f o r cu s to mers
 
descrip tionTe xt
 
S trin g
 
Pro d u ctd es crip tio n
 
redempt ionIns truct ions
 
S trin g
 
Ho w to red eem th e p ro d u ct
 
termsAn dCondi tions
 
S trin g
 
Term s  an d  co nd itio n s
 
attachm ents
 
Ar ray
 
Pro d u ct imag es  an d as s ets
 
categor ies
 
Ar ray
 
Pro d u ct categ o ries
 
variant s
 
Ar ray
 
Availa ble p ro d u ct varian ts
 


V a ria nt F i elds
 
F ie ld
 
T y pe
 
D e sc ript ion
 
variant ID
 
S trin g
 
Uniqu e varian t id en t if ier
 
variant Name
 
S trin g
 
I n tern al varian t n ame
 
variant Displa yName
 
S trin g
 
D is p lay n ame f o r cu s to mers
 
mrp
 
N u mber
 
Maximu m retail p rice
 
price
 
N u mber
 
Yo u r co s t price
 
margin
 
N u mber
 
Marg in  p ercen tag e
 
stock
 
N u mber
 
Availa ble s to ck qu an tity
 
Ca tegory F i elds
 
F ie ld
 
T y pe
 
D e sc ript ion
 
categor yID
 
S trin g
 
Categ o ry id en tif ier
 
categor yName
 
S trin g
 
Categ o ry d is p lay n ame
 
Product Catego ries
 
Co mmo n p ro du ct categ o ries  in clu d e:
 

 
E nt e rt a inme nt & Ga m ing
 

 
S of t wa re & T ec h nol ogy
 

 
E
-
c om m e rc e & R et a il
 



 
F ood  & Be ve ra ge
 

 
T ra ve l &  T ra nsp ort at ion
 

 
T e le c om mu nic at ions
 
Pagination E xam pl e
 
// Exa mp le: Fe tc ha ll pr od uct s
 
asy nc
 
fu nct ion
 
g etA ll Pro du cts
() {
 
  
l et
 
al lPr odu ct s= [ ];
 
  
l et
 
ne xtC urs or = 
nu ll
;
 
 
  
do
 
{
 
  
co ns t
 
u rl = nex tC urs or
 
  
? 
`
${ bas eU rl}
/p rod uc ts/ de liv ery
-
par tne rs /
${ dpI D}
?ne xt Cur so r=
$ {n ext Cur s or}
&li mi t=1 00`
 
  
: 
`
${ bas eU rl}
/p rod uc ts/ de liv ery
-
par tne rs /
${ dpI D}
?li mi t=1 00 `
;
 
 
  
co ns t
 
r esp on se = 
awa it
 
fe tc h
(u rl,  {
 
  
he ade rs
: {
 
   
"x
-
cli en t
-
i d"
:c li ent Id ,
 
   
"x
-
cli en t
-
s ec ret "
: cl ie ntS ecr e t,
 
  
},
 
  
}) ;
 
 
  
co ns t
 
d ata =  
aw ai t
 
r es pon se .
js on
();
 
  
al lP rod uct s.
pus h
( ... da ta. pr odu cts ) ;
 
  
ne xt Cur sor = da ta .pa gi nat io nIn fo. h asM ore
 
  
? dat a.p ag ina ti onI nf o.n ex tCu rso r
 
  
: 
nul l
;
 
  
} 
wh il e
 
( nex tC urs or );
 
 
  
r etu rn
 
al lPr od uct s;
 
}
 
 


Erro rR espo nses
 
U na uthori z ed A c c ess
 
{
 
  
" err or "
: 
"un au the nt ica te d"
,
 
  
" err Co de"
: 
" UN AUT HO RIZ ED "
 
}
 
 
Inva li d D P ID
 
{
 
  
" err or "
: 
"fo rb idd en :p ar am: a dmi nu s er doe s not ha ve ac ce ss to DP : 
INV ALI D_ DP_ ID"
,
 
  
" err Co de"
: 
" FO RBI DD EN"
 
}
 
 
Use Cases
 
1 .  Produc t Ca ta log D i spla y
 
S h o w available p ro d u cts to  yo u r cu s to mers  with p ricin g  an d  d es crip tion s .
 
2 .  Inventory M a na gem ent
 
Track wh ich  p ro du cts  and  varian ts  are avail able f o ro rd erin g .
 
3 .  Pri c e Compa rison
 
Co mp are p ricin g  acros s d if f eren t varian ts  an d p rod u cts .
 


4 .  Ca tegory B row si ng
 
Allo w cus to mers  to  bro ws e p ro du cts  by categ o ry.
 
B est Practices
 
1.
 
C a ch e P rod uc t D at a
: Prod u cts d on 't ch an g e f requ en tly,  s o imp lemen t cach in g
 
2.
 
U se P a gina t ion
: F etch  p ro du cts  in  man ag eable ch u n ks
 
3.
 
H a nd le  Im a ge s
:  Pro p erly d isp lay p rod u ct attach men ts / imag es
 
4.
 
F il te r by C at e gory
:  Allo w us ers  to f ilter by p ro duct categ o ries
 
5.
 
S h ow Av a il a bil it y
: D is p lay real
-
time avail abil ity i n f o rm atio n
 
I ntegration Exa mpl e
 
// Exa mp le: Bu il dp ro duc t cat al og
 
asy nc
 
fu nct ion
 
b uil dP rod uc tCa ta log
() {
 
  
c ons t
 
pro duc ts = 
aw ait
 
g etA ll Pro duc t s
() ;
 
 
  
/ /G ro up by ca teg or ies
 
  
c ons t
 
cat alo g ={ };
 
 
  
p rod uc ts.
for Ea ch
( (p rod uc t) => {
 
  
pr od uct .ca te gor ie s.
f or Eac h
( (ca teg o ry) => {
 
  
if
 
(! cat al og[ ca teg or y.c at ego ryN a me] ){
 
   
cat alo g[ cat eg ory .c ate go ryN ame ] = [];
 
  
}
 
  
ca tal og[ ca teg or y.c at ego ry Nam e].
p ush
({
 
   
... pro du ct,
 
   
var ian ts
:p ro duc t. var ia nts .
ma p
((v ari an t) => ({
 
    
. ..v ar ian t,
 
    
d isp la yPr ic e
: 

${v ar ian t.p r ice }
`
,
 
    
s avi ng s
:
 
     
va ri ant .m rp > var ia nt. pri c e? va ri ant .mr p 
-
 
var ian t. pri ce : 
0
,
 
   
})) ,
 


   
}) ;
 
  
}) ;
 
  
} );
 
 
  
r etu rn
 
ca tal og ;
 
}
 
 
Get  Produc t  by ID
 
Get d eta iled  in f o rm atio n  abo u t as p ecif ic p ro d u ctan d  all its  varian ts .
 
Endpo int
 
GET /v 1/ pro duc ts /de li ver y
-
par tn ers /{d p ID} /{p ro duc tID }
 
 
Headers
 
H e ad e r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
x
-
clien t
-
id
 
S trin g
 
Yo u r clien tI D
 


 
Yes
 
x
-
clien t
-
secr et
 
S trin g
 
Yo u r clien tS ecret
 


 
Yes
 
Path Par ameter s
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 


dpID
 
S trin g
 
Yo u rd elivery p artner I D
 


 
Yes
 
product ID
 
S trin g
 
Pro d u ct id en tif ier
 


 
Yes
 
P R OD UCTI D FOR M AT
 
Pro d u ctI D s fo llo w th e p attern :  
PROD
-
{UUID}
 
( e. g . ,  
PROD
-
cd250 a2a
-
2 b27
-
4 0e0
)
 
Exa mpl e R eq uest
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /pr od uct s/ del ive r y
-
p art ne rs/ YOU R_ DP_ ID /PR OD
-
cd2 50a 2a
-
2b 27
-
40 e0
'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 
R espo nse
 
Suc c essf ul R esponse
 
{
 
  
" pro du ctI D"
: 
" PRO D
-
cd2 50 a2a
-
2 b27
-
40 e 0"
,
 
  
" att ac hme nts "
: [
 
  
"
h tt ps: //s to rag e. goo gl eap is .co m/e x lr8
-
as se ts/ 0e6 ff fdd
-
6 7e7
-
4 1f1
-
bf8 7
-
1 2a dc5 97d 4c b/i ma ges /p rod uc ts/ def a ult _vo uc her .jp g
"
 
  
],
 
  
" cat eg ori es"
: [
 
  
{
 
  
"c ate gor yI D"
: 
" CAT
-
e 0bc 01 c8
-
a9b 2
-
4d 3a"
,
 
  
"c ate gor yN ame "
: 
"G am ing "
 
  
}
 
  
],
 
  
" des cr ipt ion Te xt"
: 
"Ge t thi s vou che r fo ri ns tan ts av ing s on yo ur 
nex tp ur cha se. S imp ly re de em it at th e ti me of ch eck ou tt o app ly th e 


dis cou nt .I t's t he pe rfe ct wa y to mak e yo ur mo ney go f urt he r"
,
 
  
" pro du ctD isp la yNa me "
: 
"T EST _P ROD UCT _ 1_D P_A PI S"
,
 
  
" pro du ctN ame "
: 
"T ES T_P RO DUC T_ 1_D P_A P IS"
,
 
  
" red em pti onI ns tru ct ion s"
: 
" To re dee m yo ur vo uch er, f oll ow th es e 
ste ps:
\
n
\
nC lic k on th eu ni que r ede mpt i on URL p rov ide d in yo ur em ail o r 
on the v ouc her p age .
\
n
\
n Ad dy ou rd esi r ed pro du cts to t he ca rt on th e 
par tne r' sw ebs it e.
\
n
\
nTh e dis co unt wi l lb ea ut oma tic al ly ap pli ed at  
che cko ut , 
o ry ou ma y nee d to en ter a u niq ue co de fou nd on y our  
vou che r.
\
n
\
nCo mp let e you r pur ch ase an d en joy y our sa vi ngs !"
,
 
  
" ter ms And Con di tio ns "
: 
"T his v ouc her  is val id fo ro ne
-
ti me us e onl y.  
2. It ca nno tb e com bi ned w ith a ny oth e ro ffe rs ,d isc ou nts , or 
pro mot io ns. 3. T his v ouc he ri s non
-
re f und abl e and ca nn ot be ex ch ang ed  
for ca sh .4 .T he vo uc her i sv al id unt i li ts st ate de xp ira ti on da te. 5 . 
Los t, s
t ole n, or da ma ged v ouc he rs wil l no tb e rep lac ed .6 . The  
mer cha nt re ser ve st he ri gh tt o mod ify  the se te rms an d con di tio ns at  
any ti me wi tho ut pr io rn ot ice "
,
 
  
" var ia nts "
: [
 
  
{
 
  
"v ari ant ID "
: 
"V AR
-
23 c2a 47 5
-
0 6cb
-
411 8"
,
 
  
"v ari ant Na me"
: 
"TE ST _PR OD UCT _1_ D P_A PIS I NR 100 "
,
 
  
"v ari ant Di spl ay Nam e"
: 
Q hee Q
,
 
  
"m rp"
: 
1 00
,
 
  
"p ric e"
: 
99
,
 
  
"m arg in"
: 
1
,
 
  
"s toc k"
: 
9 99
 
  
}
 
  
]
 
}
 
 
R espo nse Fields
 
Produc t Inf orma ti on
 
F ie ld
 
T y pe
 
D e sc ript ion
 


product ID
 
S trin g
 
Uniqu e p ro du ct id en tif ier
 
product Name
 
S trin g
 
I n tern al p rod u ct n ame
 
product Displa yName
 
S trin g
 
Cu s to mer
-
f acin g d is p lay n ame
 
descrip tionTe xt
 
S trin g
 
D etail ed  p rod u ct d es crip tio n
 
redempt ionIns truct ions
 
S trin g
 
S tep
-
by
-
s tep  red emp tio n  g u id e
 
termsAn dCondi tions
 
S trin g
 
Pro d u ct term s an d  co n d itio n s
 
attachm ents
 
Ar ray
 
Pro d u ct imag es  an d marketin g  materials
 
categor ies
 
Ar ray
 
Pro d u ct categ o ries
 
variant s
 
Ar ray
 
All availa ble var ian ts  f o r th is  pro du ct
 
V a ria nt Inf orma ti on
 
F ie ld
 
T y pe
 
D e sc ript ion
 
variant ID
 
S trin g
 
Uniqu e varian t id en t if ier (u s e f o r ord erin g )
 
variant Name
 
S trin g
 
I n tern al varian t n ame
 
variant Displa yName
 
S trin g
 
Cu s to mer
-
f acin g  varian t n ame
 
mrp
 
N u mber
 
Maximu m retail p rice
 
price
 
N u mber
 
Yo u r wh o les ale/ co s t p rice
 
margin
 
N u mber
 
Marg in  p ercen tag e
 


stock
 
N u mber
 
Availa ble s to ck qu an tity
 
Ca tegory F i elds
 
F ie ld
 
T y pe
 
D e sc ript ion
 
categor yID
 
S trin g
 
Categ o ry id en tif ier
 
categor yName
 
S trin g
 
Categ o ry d is p lay n ame
 
Product Detail s Usage
 
Th is  en d po in t is  id eal fo r:
 
1 .  Produc t D eta i l Pa ges
 
S h o w co mp reh ens ive p ro du ct in fo rm atio n  to cus to mers  bef ore p urch as e.
 
2 .  Va ria nt S elec ti on
 
D is p lay all avail able d en o min atio n s / varian ts  f o r a p rod u ct.
 
3 .  Pri c i ng Inf orma ti on
 
Get cu rr en t p ricin g  fo rs p ecif ic p rod u cts .
 
I ntegration Exa mpl e
 
// Exa mp le: Cr ea te pr odu ct de ta il pag e
 
asy nc
 
fu nct ion
 
g etP ro duc tD eta il s
(p rod u ctI D) {
 


  
t ry
 
{
 
  
co ns t
 
r esp on se = 
awa it
 
fe tc h
(
 
  
`
$ {ba seU rl }
/p ro duc ts /de li ver y
-
p a rtn ers /
$ {dp ID}
/
$ {pr od uct ID }
`
,
 
  
{
 
   
hea der s
: {
 
    
"x
-
c li ent
-
i d"
: c lie nt Id,
 
    
"x
-
c li ent
-
s ecr et "
: cl ien tSe c ret ,
 
   
},
 
  
}
 
  
);
 
 
  
if
 
( !re spo ns e.o k) {
 
  
co nst
 
er ro r=  
a wai t
 
res po nse .
js o n
() ;
 
  
th row
 
ne w
 
Err or (
`
$ {e rro r. err Cod e }
: 
${e rr or. err or }
`
);
 
  
}
 
 
  
co ns t
 
p rod uc t=  
a wai t
 
res po nse .
js o n
() ;
 
 
  
// F orm at fo rd is pla y
 
  
re tu rn
 
{
 
  
.. .pr odu ct ,
 
  
fo rma tte dV ari an ts
: p rod uc t.v ari a nts .
ma p
( (va ria nt )= > ({
 
   
... var ia nt,
 
   
dis pla yP ric e
: 

${ var ia nt. pri c e.
t oLo ca leS tri ng
()}
`
,
 
   
ori gin al Pri ce
:
 
    
v ari an t.m rp > 
0
 
? 

$ {va ria n t.m rp.
to Loc ale St rin g
( )}
`
 
: 
nu ll
,
 
   
dis cou nt
:
 
    
v ari an t.m rp > va ria nt .pr ice
 
     
? Ma th.
ro und
(( (va ri ant .mr p  
-
 
var ia nt. pri ce )/ v ari an t.m rp ) 
* 
1 00
)
 
     
: 
0
,
 
  
}) ),
 
  
ca teg ory Na mes
: pro du ct. ca teg ori e s
 
   
.
ma p
(( ca t) => ca t. cat eg ory Nam e )
 
   
.
jo in
(
", "
),
 
  
};
 
  
} 
ca tc h
 
( err or ){
 
  
co ns ole .
er ro r
(
" Er ror f etc hi ng pro d uct de ta ils :"
, e rro r) ;
 
  
th ro w
 
e rro r;
 


  
}
 
}
 
 
Erro rR espo nses
 
Produc t N ot F ound
 
{
 
  
" err or "
: 
"pr od uct n ot fo und f or dpI D :Y OUR _D P_I D, pr odu ct ID:  
PRO DUC T_ ID"
,
 
  
" err Co de"
: 
" RE COR D_ NOT _F OUN D"
 
}
 
 
U na uthori z ed A c c ess
 
{
 
  
" err or "
: 
"un au the nt ica te d"
,
 
  
" err Co de"
: 
" UN AUT HO RIZ ED "
 
}
 
 
Ac c ess D eni ed
 
{
 
  
" err or "
: 
"fo rb idd en :p ar am: a dmi nu s er doe s not ha ve ac ce ss to DP : 
INV ALI D_ DP_ ID"
,
 
  
" err Co de"
: 
" FO RBI DD EN"
 
}
 
 


B est Practices
 
1.
 
C a ch e P rod uc t D et a il s
:  Prod u ct inf o rm atio n ch an g es  in f requ en tly
 
2.
 
H a nd le M issing I ma ge s
:  Gracef u lly h and le p ro du cts  with ou t attach men ts
 
3.
 
D isp l a y Va ria nt s C le a rly
: S ho w all availabl e d en o min atio n s /o p tio n s
 
4.
 
F orm a t P ric ing
:  Pres en t p ricin g  in us er
-
f rien d lyfo rm ats
 
5.
 
S h ow R ed e mp t ion I nf o
:  Clearly d is p layh o w cu s to mers  can u s e th ep rod u ct
 
Use Cases
 
1 .  Produc t Compa rison
 
Co mp are d iff eren t varian ts  o f  th e s ame p ro d u ct.
 
2 .  Customer E duc a ti on
 
S h o wd etailed  p ro du ct in fo rm atio n  an d red emp tio n  in s tru ctio n s .
 
3 .  Inventory P la nni n g
 
Und ers tan d  availabl e varian ts  f o r in ven to ry p lan nin g .
 
Place Order
 
Place a n ew o rd er u s in g a un iqu e extern al ref eren ce an d  p rod u ct varian t.
 
Endpo int
 
POS T/ v1 /or der s/ b2b /d ire ct
-
ch ec kou t
 
 


Headers
 
H e ad e r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
x
-
clien t
-
id
 
S trin g
 
Yo u r clien tI D
 


 
Yes
 
x
-
clien t
-
secr et
 
S trin g
 
Yo u r clien tS ecret
 


 
Yes
 
Content
-
Type
 
S trin g
 
Mu s t be 
application /json
 


 
Yes
 
R eq uest B o dy
 
F or Produc t Orders
 
F ie ld
 
T y pe
 
D e sc ript ion
 
R e qu ire
d
 
dpID
 
S trin g
 
Yo u rd elivery p artner I D  (s ame as  clien tI D )
 


 
Yes
 
variant ID
 
S trin g
 
Pro d u ct varian t id en tif ier
 


 
Yes
 
externa lRefID
 
S trin g
 
Uniqu e ref eren ce I D  p ro vid ed  by clien t
 
0
 
No
 
{
 
  
" dpI D"
: 
" {YO UR _DP _I D}"
,
 
  
" var ia ntI D"
: 
" VAR
-
3 455 a0 e1
-
47 c8
-
4e6 f "
,
 
  
" ext er nal Ref ID "
: 
"{ uni qu eRe fI DTo BeP r ovi ded By Cli ent }"
 
}
 
 
UN I QUEEXT ER N ALR EF ER EN CE
 
Th e 
external RefID
 
mu s t be u n iqu e f or each o rd er.  Th is  is you r ref eren ce fo r trackin g  th e 
o rd er in yo u r s ys tem.
 


Exa mpl e R eq uest
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /or de rs/ b2 b/d ire c t
-
c hec ko ut
'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
\
 
  
--
he ad er
 
'Co nt ent
-
T ype : app li cat ion / jso n'
 
\
 
  
--
da ta
 
'{
 
  
"d pI D": "{ YO UR_ DP _ID }" ,
 
  
"v ar ian tID ": "V AR
-
34 55 a0e 1
-
47c 8
-
4 e 6f" ,
 
  
"e xt ern alR ef ID" : "or de r
-
07
-
09
-
202 5 "
 
  
}'
 
 
R espo nse
 
Suc c essf ul R esponse
 
{
 
  
" ord er ID"
: 
" OR DIN 08 092 02 52e 96 25e "
,
 
  
" ext er nal Ref ID "
: 
"o rde r
-
07
-
09
-
20 25"
,
 
  
" dpU se rEm ail "
: 
"
j oh ndo e@ gma il .co m
"
,
 
  
" dpU se rNa me"
: 
"Te st DP "
,
 
  
" dpI D"
: 
" 51d 15 1ae
-
7 d8d
-
4 160
-
9 1dd
-
ef 8 497 46f 78 9"
,
 
  
" tot al Ord erM RP "
: 
10 0
,
 
  
" tot al Amo unt "
: 
99
,
 
  
" tot al Cos tPr ic e"
: 
99
,
 
  
" sta tu s"
: 
"C OM PLE TE D"
,
 
  
" ful fi llm ent St atu s"
: 
" FU LFI LL ED"
,
 
  
" cre at edA t"
: 
" 202 5
-
09
-
08 T10 :0 3:5 5.5 4 1Z"
,
 
  
" upd at edA t"
: 
" 202 5
-
09
-
08 T10 :0 4:5 0.8 7 9Z"
,
 
  
" ass et URL "
: 
""
,
 
  
" typ e"
: 
" DIR EC T_C HE CKO UT "
,
 
  
" lin eI tem s"
: [
 
  
{
 
  
"v ari ant ID "
: 
"V AR
-
34 55a 0e 1
-
4 7c8
-
4e6 f"
,
 


   
"p rod uct ID "
: 
"P ROD
-
c f51 c2 4f
-
425 a
-
46 3b"
,
 
  
"q uan tit y"
: 
1
,
 
  
"m rp"
: 
1 00
,
 
  
"p ric e"
: 
99
,
 
  
"t ota lMR P"
: 
1 00
,
 
  
"t ota lPr ic e"
: 
99
,
 
  
"v ari ant Na me"
: 
"TE ST _PR OD UCT _2_ D P_A PIS I NR 100 "
,
 
  
"p rod uct Na me"
: 
"TE ST _PR OD UCT _2_ D P_A PIS "
,
 
  
"v ari ant Di spl ay Nam e"
: 
Q hee Q
,
 
  
"p rod uct Di spl ay Nam e"
: 
" TE ST_ PRO D UCT _2_ DP _AP IS"
,
 
  
"a tta chm en ts"
: [
 
   
"
ht tps :/ /st or age .g oog le api s.c o m/e xlr 8
-
ass ets /v ouc her _b ulk _u plo ad s/d ef aul t_v o uch er. jp g
"
 
  
],
 
  
"m obi leN um ber s"
: 
n ul l
,
 
  
"v ouc her s"
: [
 
   
{
 
    
" vou ch erC od e"
: 
" 787 76 667 "
,
 
    
" vou ch erP in "
: 
"T 6R9
-
Q 3M8
-
C4 V VB1 200 "
,
 
    
" exp ir ati on Dat e"
: 
" 20 28
-
01
-
0 2T0 0:0 0: 00Z "
 
   
}
 
  
],
 
  
"f ulf ill me ntS ta tus "
: 
"F UL FIL LED "
,
 
  
"a llo cat ed Qty "
: 
1
,
 
  
"f ulf ill ed Qty "
: 
1
 
  
}
 
  
]
 
}
 
 
R esponse F i elds
 
F ie ld
 
T y pe
 
D e sc ript ion
 
orderID
 
S trin g
 
S ys tem
-
g en erated  u n iqu e o rd er id en tif ier
 
externa lRefID
 
S trin g
 
Yo u rp ro vid ed  extern al ref eren ce
 


dpUserE mail
 
S trin g
 
E mail o f  th e D Pu s er
 
dpUserN ame
 
S trin g
 
N ame o f  th e D Pu s er
 
dpID
 
S trin g
 
Yo u rd elivery p artner I D
 
totalOr derMRP
 
N u mber
 
To tal MRP o f  th e o rd er
 
totalAm ount
 
N u mber
 
To tal amo u n t ch arg ed
 
totalCo stPric e
 
N u mber
 
To tal co s t p rice
 
status
 
S trin g
 
Ord er s tatu s  (s ee 
S tatu s  Co d es
)
 
fulfill mentSt atus
 
S trin g
 
F u lf illmen t s tatu s (s ee 
S tatu s  Cod es
)
 
created At
 
S trin g
 
Ord er creatio n  times tamp  (I S O 8 6 01 )
 
updated At
 
S trin g
 
L as t u pd ate times tamp  (I S O 8 6 0 1 )
 
assetUR L
 
S trin g
 
URL  to d o wn lo ad o rd erd etails  (wh en  f u lf illed )
 
type
 
S trin g
 
Ord er typ e
 
lineIte ms
 
Ar ray
 
Ar ray o f o rd ered  items  with  d etails
 
L i ne Item F i elds
 
F ie ld
 
T y pe
 
D e sc ript ion
 
variant ID
 
S trin g
 
Pro d u ct varian t id en tif ier
 
product ID
 
S trin g
 
Pro d u ct id en tif ier
 


quantit y
 
N u mber
 
Qu an tity o rd ered
 
mrp
 
N u mber
 
Maximu m retail p rice p er u n it
 
price
 
N u mber
 
Actu al p rice ch arg ed  p eru n it
 
totalMR P
 
N u mber
 
To tal maximu m retail p rice f o r th e lin e item
 
totalPr ice
 
N u mber
 
To tal actu al p rice ch arg ed  f o r th e lin e item
 
variant Name
 
S trin g
 
Varian t n ame
 
product Name
 
S trin g
 
Pro d u ctn ame
 
variant Displa yName
 
S trin g
 
D is p lay n ame f o r th e varian t
 
product Displa yName
 
S trin g
 
D is p lay n ame f o r th e pro du ct
 
attachm ents
 
Ar ray
 
Ar ray o f attach men t URL s  (e. g . ,  imag es o rd o cu men ts )
 
mobileN umbers
 
Ar ray
 
Ar ray o f mo bile n u mbers (if  ap p licable,  e. g . ,  fo r SIM card s )
 
voucher s
 
Ar ray
 
Vo u ch er d etails  (wh en  f u lf illed ) 
-
 
s ee 
Vo u ch er F ield s
 
fulfill mentSt atus
 
S trin g
 
I tem f u lf illmen t s tatu s  (s ee 
S tatu s  Co d es
)
 
allocat edQty
 
N u mber
 
Qu an tity allo cat ed
 
fulfill edQty
 
N u mber
 
Qu an tity f u lf illed
 
V ouc her F i elds
 
Wh en  vo u ch ers  are availabl e (o rd er s tatu s  is 
COMPLETED
 
an d  f u lf illmen t s tatu s is  
FULFILL ED
),  each  vo u ch er o bj ect co n tain s :
 


F ie ld
 
T y pe
 
D e sc ript ion
 
voucher Code
 
S trin g
 
Th e vo u ch er co d e to be u s ed by th e cus to mer
 
voucher Pin
 
S trin g
 
Th e vo u ch er PI N f o r activatio n
 
expirat ionDat e
 
S trin g
 
Vo u ch er exp iratio n  d ate (I S O 8 60 1 f orm at)
 
E xa m p le v ou ch e r obje ct :
 
{
 
  
" vou ch erC ode "
: 
"7 87 766 67 "
,
 
  
" vou ch erP in"
: 
"T6 R9
-
Q3 M8
-
C4 VV B12 00"
,
 
  
" exp ir ati onD at e"
: 
" 202 8
-
01
-
02 T00 :00 : 00Z "
 
}
 
 
OrderSta tus Codes
 
Th e o rd er willh ave o n e of  two f in al s tatu s es:
 
S t at u s
 
D e sc ript ion
 
N e xt S te p s
 
COMPLET ED
 
Ord er s u cces sf u lly co mp leted
 
D o wn lo ad vo u ch ers  if  availabl e
 
FAILED
 
Ord er f ailed  d u ring  p ro ces s in g
 
Ch eck err o rd etails  an d  retry
 
A sset Do w nl o ad
 
Wh en  o rd er s tatu s  is  
COMPLETED
 
an d  
fulfillme nt Status
 
is  
FULFIL LED
:
 
1.
 
D ownl oa d  t he f il e
 
f ro m 
assetURL
.
 
2.
 
U se t he p a ssword
 
s en to ver email to  o p en th e f ile.
 
3.
 
E xt ra ct v ou c he r inf orm a t ion
 
f o r d elivery to  your cu s to mers .
 


Erro rR espo nses
 
Insuf f i c i ent B a la nc e
 
{
 
  
" err or "
: 
"in su ffi ci ent w all et ba lan c e"
,
 
  
" err Co de"
: 
" IN SUF FI CIE NT _BA LA NCE "
 
}
 
 
Produc t N ot A va i la b le
 
{
 
  
" err or "
: 
"in su ffi ci ent s toc k for va r ian tV AR IAN T_I D. Av ai lab le : 
AVA ILA BL E_S TOC K_ COU NT ,R eq ues te d: REQ U EST ED_ ST OCK _CO UN T"
,
 
  
" err Co de"
: 
" OU T_O F_ STO CK "
 
}
 
 
Inva li d R eq uest
 
{
 
  
" err or "
: 
"in va lid v ari an tI D"
,
 
  
" err Co de"
: 
" BA D_R EQ UES T"
 
}
 
 
B est Practices
 
1.
 
U niqu e E xt e rna l R e fe re nc e s
:  Always u s eu n iqu e 
externalRe fID
 
valu es
 
2.
 
E rror H a nd l ing
: I mp lemen t p rop er err o r h an d ling  fo r all resp o ns e co d es
 
3.
 
S t at u sC he c k
: Ch eck o rd er s tatu s to s ee if  it's  
COMPLETED
 
o r 
FAILED
 
4.
 
Asse t  D ownl oa d
:  Do wn lo ad an d s ecu rely s to re vo u ch er f iles  wh en s tatu s  is 
COMPLET ED
 


 
Get  Orders
 
Get a p ag in at ed  lis t o f o rd ers  with o p tion al f ilters s u ch as  d ate ran g e an d p ag in atio n  
p arameters .
 
Endpo int
 
GET /v 1/ ord ers /b 2b/ de liv er y
-
p ar tne rs/ { dpI D}
 
 
Headers
 
H e ad e r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
x
-
clien t
-
id
 
S trin g
 
Yo u r clien tI D
 


 
Yes
 
x
-
clien t
-
secr et
 
S trin g
 
Yo u r clien tS ecret
 


 
Yes
 
Path Par ameter s
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
dpID
 
S trin g
 
Yo u rd elivery p artner I D
 


 
Yes
 


QueryPara meters
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire
d
 
D e f au l t
 
nextCur sor
 
S trin g
 
Pag in at io n  cu rso r fo r n ext p ag e
 
0
 
No
 
-
 
limit
 
I n teg er
 
N u mber of  reco rd s p er p ag e
 
0
 
No
 
15
 
P AGI N AT I ON LI MI T S
 

 
D e f au l t l im it
: 1 5 reco rds  p er p ag e
 

 
M a xim u m l im it
: 1 0 0 reco rd s p er p ag e
 
Exa mpl e R eq uest
 
G et F i rst Pa ge of  Orders
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /or de rs/ b2 b/d eli v ery
-
pa rt ner s/Y OU R_D P_ ID
'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 
G et Orders w i th Pa gi na ti on
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /or de rs/ b2 b/d eli v ery
-
pa rt ner s/Y OU R_D P_ ID
'
 
\
 
  
--
da ta
-
ur len co de 
'l imi t= {li mi t}'
 
\
 
  
--
da ta
-
ur len co de 
'n ext Cu rso r= {ne xtC u rso r}'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 


R espo nse
 
Suc c essf ul R esponse
 
{
 
  
" ord er s"
: [
 
  
{
 
  
"o rde rID "
: 
"O RD IN0 80 920 25 2e9 625 e "
,
 
  
"e xte rna lR efI D"
: 
" or der
-
07
-
09
-
2 0 25"
,
 
  
"d pUs erE ma il"
: 
"
jo hn doe @g mai l.c o m
"
,
 
  
"d pUs erN am e"
: 
" Tes t DP"
,
 
  
"d pID "
: 
"5 1d1 51 ae
-
7d 8d
-
41 60
-
91d d
-
ef 849 74 6f7 89"
,
 
  
"t ota lOr de rMR P"
: 
1 00
,
 
  
"t ota lAm ou nt"
: 
99
,
 
  
"t ota lCo st Pri ce "
: 
99
,
 
  
"s tat us"
: 
"CO MP LET ED "
,
 
  
"f ulf ill me ntS ta tus "
: 
"F UL FIL LED "
,
 
  
"c rea ted At "
: 
"2 025
-
09
-
0 8T 10: 03: 5 5.5 41Z "
,
 
  
"u pda ted At "
: 
"2 025
-
09
-
0 8T 10: 04: 5 0.8 79Z "
,
 
  
"a sse tUR L"
: 
""
,
 
  
"t ype "
: 
"D IRE CT _CH EC KOU T"
,
 
  
"l ine Ite ms "
: [
 
   
{
 
    
" var ia ntI D"
: 
" VA R
-
3 45 5a0 e1
-
4 7c8
-
4e 6f "
,
 
    
" pro du ctI D"
: 
" PR OD
-
cf 51c 24f
-
425 a
-
4 63 b"
,
 
    
" qua nt ity "
: 
1
,
 
    
" mrp "
: 
10 0
,
 
    
" pri ce "
: 
99
,
 
    
" tot al MRP "
: 
10 0
,
 
    
" tot al Pri ce "
: 
99
,
 
    
" var ia ntN am e"
: 
" TES T_ PRO DUC T _2_ DP_ AP IS INR 1 00"
,
 
    
" pro du ctN am e"
: 
" TES T_ PRO DUC T _2_ DP_ AP IS"
,
 
    
" var ia ntD is pla yN ame "
: 
Qhe e Q
,
 
    
" pro du ctD is pla yN ame "
: 
"T EST _ PRO DUC T_ 2_D P_A PI S"
,
 
    
" att ac hme nt s"
: [
 
     
"
h tt ps: // sto ra ge. go ogl eap i s.c om/ ex lr8
-
ass ets /v ouc her _b ulk _u plo ad s/d ef aul t_v o uch er. jp g
"
 
    
],
 


     
" mob il eNu mb ers "
: 
nu ll
,
 
    
" vou ch ers "
: [
 
     
{
 
     
"v ouc he rCo de "
: 
"7 877 666 7 "
,
 
     
"v ouc he rPi n"
: 
" T6 R9
-
Q3M 8
-
C4 VVB 12 00"
,
 
     
"e xpi ra tio nD ate "
: 
"2 028
-
01
-
02T 00 :00 :00 Z"
 
     
}
 
    
],
 
    
" ful fi llm en tSt at us"
: 
"FU LFI L LED "
,
 
    
" all oc ate dQ ty"
: 
1
,
 
    
" ful fi lle dQ ty"
: 
1
 
   
}
 
  
]
 
  
}
 
  
],
 
  
" pag in ati onI nf o"
: {
 
  
"n ex tCu rso r"
: 
""
,
 
  
"h as Mor e"
: 
f als e
 
  
}
 
}
 
 
R esponse F i elds
 
F ie ld
 
T y pe
 
D e sc ript ion
 
orders
 
Ar ray
 
Ar ray o f o rd er o bj ects
 
paginat ionInf o
 
Obj ect
 
Pag in at io n  in f orm atio n
 
Pa gi na ti on Inf o
 
F ie ld
 
T y pe
 
D e sc ript ion
 
nextCur sor
 
S trin g
 
Cu rso rf o r th e n ext p ag e (emp ty if  no  mo re p ag es )
 


hasMore
 
Bo o lean
 
Wh eth er mo re reco rd s  are available
 
Pagination E xam pl e
 
// Exa mp le: Fe tc ha ll or de rs
 
let
 
al lO rde rs = [];
 
let
 
ne xt Cur sor =  
nu ll
;
 
 
do
 
{
 
  
c ons t
 
url = ne xtC ur sor
 
  
? 
`
$ {ba seU rl }
/o rd ers /b 2b/ de liv ery
-
par tne rs /
${ dpI D}
?ne xt Cur so r=
$ {n ext Cur s or}
`
 
  
: 
`
$ {ba seU rl }
/o rd ers /b 2b/ de liv ery
-
par tne rs /
${ dpI D}
`
;
 
 
  
c ons t
 
res pon se = 
aw ait
 
f etc h
( url ,{
 
  
he ad ers
: {
 
  
"x
-
cl ien t
-
id"
: cli en tId ,
 
  
"x
-
cl ien t
-
sec re t"
: c lie nt Sec ret ,
 
  
},
 
  
} );
 
 
  
c ons t
 
dat a=  
a wai t
 
res po nse .
j son
();
 
  
a llO rd ers .
pu sh
(.. .d ata .o rde rs );
 
  
n ext Cu rso r= d ata .p agi na tio nI nfo .ha s Mor e
 
  
? da ta. pag in ati on Inf o. nex tC urs or
 
  
: 
nu ll
;
 
} 
w hil e
 
(ne xtC ur sor );
 
 


Erro rR espo nses
 
U na uthori z ed A c c ess
 
{
 
  
" err or "
: 
"un au the nt ica te d"
,
 
  
" err Co de"
: 
" UN AUT HO RIZ ED "
 
}
 
 
Inva li d D P ID
 
{
 
  
" err or "
: 
"fo rb idd en :p ar am: a dmi nu s er doe s not ha ve ac ce ss to DP : 
INV ALI D_ DP_ ID"
,
 
  
" err Co de"
: 
" FO RBI DD EN"
 
}
 
 
Use Cases
 
1 .  Order Hi story D a shb oa rd
 
D is p lay recen t o rd ers  with p ag in atio n  fo r yo u r users .
 
2 .  R ec onc i li a ti on
 
F etch  all o rd ers fo r as p ecif ic time p erio d  to reco ncile with  yo u r reco rd s .
 
3 .  S ta tus M oni tori ng
 
R eg u larly p o ll fo ro rd ers th at n eed  s tatu s up d ates .
 


B est Practices
 
1.
 
U se P a gina t ion
: D o n 't try to f etch  all o rd ers  at once
 
2.
 
I m p le m e nt C ac h ing
: Cach e o rd er d ata to  redu ceAPI  calls
 
3.
 
H a nd le  Em pt y R e su l t s
:  Gracef u lly h and le cas es with  n o o rd ers
 
4.
 
M onit or P e rf orm a nce
: Us e ap p ro p riate p ag e s izes  f or you ru s e cas e
 
 
Get  Order b y I D
 
F etch  d etailed  in f o rm atio n  fo r as p ecif ic o rd er us in g  th es ys tem
-
g en erated  o rd er ID .
 
Endpo int
 
GET /v 1/ ord ers /b 2b/ de liv er y
-
p ar tne rs/ { dpI D}/ {o rde rID }
 
 
Headers
 
H e ad e r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
x
-
clien t
-
id
 
S trin g
 
Yo u r clien tI D
 


 
Yes
 
x
-
clien t
-
secr et
 
S trin g
 
Yo u r clien tS ecret
 


 
Yes
 
Path Par ameter s
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 


dpID
 
S trin g
 
Yo u rd elivery p artner I D
 


 
Yes
 
orderID
 
S trin g
 
S ys tem
-
g en erated  o rd er id en tif ier
 


 
Yes
 
OR D ER I D FOR M AT
 
Ord er I D s fo llo w th e p attern :  
ORDIN{DATE}{ RANDO M}
 
(e. g . ,  
ORDIN08092 0252e 9625e
)
 
Exa mpl e R eq uest
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /or de rs/ b2 b/d eli v ery
-
par tne rs /YO UR_ DP _ID /O RDI N0 809 20 252 e96 2 5e
'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 
R espo nse
 
Suc c essf ul R esponse
 
{
 
  
" ord er ID"
: 
" OR DIN 08 092 02 52e 96 25e "
,
 
  
" ext er nal Ref ID "
: 
"o rde r
-
07
-
09
-
20 25"
,
 
  
" dpU se rEm ail "
: 
"
j oh ndo e@ gma il .co m
"
,
 
  
" dpU se rNa me"
: 
"Te st DP "
,
 
  
" dpI D"
: 
" 51d 15 1ae
-
7 d8d
-
4 160
-
9 1dd
-
ef 8 497 46f 78 9"
,
 
  
" tot al Ord erM RP "
: 
10 0
,
 
  
" tot al Amo unt "
: 
99
,
 
  
" tot al Cos tPr ic e"
: 
99
,
 
  
" sta tu s"
: 
"C OM PLE TE D"
,
 
  
" ful fi llm ent St atu s"
: 
" FU LFI LL ED"
,
 
  
" cre at edA t"
: 
" 202 5
-
09
-
08 T10 :0 3:5 5.5 4 1Z"
,
 
  
" upd at edA t"
: 
" 202 5
-
09
-
08 T10 :0 4:5 0.8 7 9Z"
,
 
  
" ass et URL "
: 
""
,
 


  
" typ e"
: 
" DIR EC T_C HE CKO UT "
,
 
  
" lin eI tem s"
: [
 
  
{
 
  
"v ari ant ID "
: 
"V AR
-
34 55a 0e 1
-
4 7c8
-
4e6 f"
,
 
  
"p rod uct ID "
: 
"P ROD
-
c f51 c2 4f
-
425 a
-
46 3b"
,
 
  
"q uan tit y"
: 
1
,
 
  
"m rp"
: 
1 00
,
 
  
"p ric e"
: 
99
,
 
  
"t ota lMR P"
: 
1 00
,
 
  
"t ota lPr ic e"
: 
99
,
 
  
"v ari ant Na me"
: 
"TE ST _PR OD UCT _2_ D P_A PIS I NR 100 "
,
 
  
"p rod uct Na me"
: 
"TE ST _PR OD UCT _2_ D P_A PIS "
,
 
  
"v ari ant Di spl ay Nam e"
: 
Q hee Q
,
 
  
"p rod uct Di spl ay Nam e"
: 
" TE ST_ PRO D UCT _2_ DP _AP IS"
,
 
  
"a tta chm en ts"
: [
 
   
"
ht tps :/ /st or age .g oog le api s.c o m/e xlr 8
-
ass ets /v ouc her _b ulk _u plo ad s/d ef aul t_v o uch er. jp g
"
 
  
],
 
  
"m obi leN um ber s"
: 
n ul l
,
 
  
"v ouc her s"
: [
 
   
{
 
    
" vou ch erC od e"
: 
" 787 76 667 "
,
 
    
" vou ch erP in "
: 
"T 6R9
-
Q 3M8
-
C4 V VB1 200 "
,
 
    
" exp ir ati on Dat e"
: 
" 20 28
-
01
-
0 2T0 0:0 0: 00Z "
 
   
}
 
  
],
 
  
"f ulf ill me ntS ta tus "
: 
"F UL FIL LED "
,
 
  
"a llo cat ed Qty "
: 
1
,
 
  
"f ulf ill ed Qty "
: 
1
 
  
}
 
  
]
 
}
 
 
#E xam pl e: Dow nl oad o rde r ass et s
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tor ag e.g oog l eap is. co m/e xlr 8
-
ass ets /o rde rs/ OR DIN 08 092 02 52e 96 25e _or d er_ det ai ls. xls x
'
 
\
 
  
--
ou tp ut
 
ord er _de ta ils .x lsx
 
 


Erro rR espo nses
 
Order Not F ound
 
{
 
  
" err or "
: 
"or de rn ot fo un dw it ho rde r ID: IN VA LID _OR DE R_I D and d pId : 
YOU R_D P_ ID"
,
 
  
" err Co de"
: 
" RE COR D_ NOT _F OUN D"
 
}
 
 
Use Cases
 
1 .  Order Sta tus U pda tes
 
R eg u larly ch eck o rd er s tatu s  to  pro vid e up d ates  to  you r cu s to mers .
 
2 .  V ouc herR etrieva l
 
D o wn lo ad an d p ro ces s vou ch er inf o rm atio n o n ceo rd ers are f u lf illed .
 
3 .  Customer Support
 
Pro vid e d etailed  o rd er in fo rm atio n  fo r cu s to mer in qu iries .
 
B est Practices
 
1.
 
P ol l  Wisel y
: Do n 't p o ll too f requ en tly f o r s tatu s up d ates
 
2.
 
C a ch e R e su l t s
:  Cach eo rd erd etails  to  red u ce APIcalls
 
3.
 
H a nd le  Al l St a te s
: I mp lemen t lo g ic fo r allp o ss ible o rd ers tates
 
4.
 
S e cu re Asse t H a nd l ing
: Pro p erlyh an d le an d s tore d o wn lo ad ed  vou ch erf iles
 


 
Get  Order b y Ex t ernal 
Refe renc e
 
F etch  d etailed  in f o rm atio n  fo r as p ecif ic o rd er us in g  you rp ro vid ed extern al ref eren ce I D .
 
Endpo int
 
GET /v 1/ ord ers /b 2b/ de liv er y
-
par tne rs /{d pID }/ ext er nal re f/{ ex ter nal R efI D}
 
 
Headers
 
H e ad e r
 
T y pe
 
D e sc ript ion
 
R e qu ire d
 
x
-
clien t
-
id
 
S trin g
 
Yo u r clien tI D
 


 
Yes
 
x
-
clien t
-
secr et
 
S trin g
 
Yo u r clien tS ecret
 


 
Yes
 
Path Par ameter s
 
P a ra me te r
 
T y pe
 
D e sc ript ion
 
R e qu ire
d
 
dpID
 
S trin g
 
Yo u rd elivery p artner I D
 


 
Yes
 


externa lRefID
 
S trin g
 
Yo u ru n iqu e extern al ref eren ce I D
 


 
Yes
 
US EYOUR R EFER EN CE
 
Th is  en d po in t is  p erf ect wh en  you  wan t to track ord ers u s in g yo u r o wn ref eren ce s ys tem 
in s tead  o f  eXlr8 's o rd er I Ds .
 
Exa mpl e R eq uest
 
cur l
 
--
l oca tio n
 
'
ht tp s:/ /s tag e
-
pla tfo r m
-
exl r8. ex lr8 now .c om/ v1 /or de rs/ b2 b/d eli v ery
-
par tne rs /YO UR_ DP _ID /e xte rn alr ef /or der
-
07
-
09
-
20 25
'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
id: Y OUR _C LIE NT_ I D'
 
\
 
  
--
he ad er
 
'x
-
cl ien t
-
sec re t: YO UR_ CLI E NT_ SEC RE T'
 
 
R espo nse
 
Suc c essf ul R esponse
 
{
 
  
" ord er ID"
: 
" OR DIN 08 092 02 52e 96 25e "
,
 
  
" ext er nal Ref ID "
: 
"o rde r
-
07
-
09
-
20 25"
,
 
  
" dpU se rEm ail "
: 
"
j oh ndo e@ gma il .co m
"
,
 
  
" dpU se rNa me"
: 
"Te st DP "
,
 
  
" dpI D"
: 
" 51d 15 1ae
-
7 d8d
-
4 160
-
9 1dd
-
ef 8 497 46f 78 9"
,
 
  
" tot al Ord erM RP "
: 
10 0
,
 
  
" tot al Amo unt "
: 
99
,
 
  
" tot al Cos tPr ic e"
: 
99
,
 
  
" sta tu s"
: 
"C OM PLE TE D"
,
 
  
" ful fi llm ent St atu s"
: 
" FU LFI LL ED"
,
 
  
" cre at edA t"
: 
" 202 5
-
09
-
08 T10 :0 3:5 5.5 4 1Z"
,
 
  
" upd at edA t"
: 
" 202 5
-
09
-
08 T10 :0 4:5 0.8 7 9Z"
,
 
  
" ass et URL "
: 
""
,
 
  
" typ e"
: 
" DIR EC T_C HE CKO UT "
,
 
  
" lin eI tem s"
: [
 


   
{
 
  
"v ari ant ID "
: 
"V AR
-
34 55a 0e 1
-
4 7c8
-
4e6 f"
,
 
  
"p rod uct ID "
: 
"P ROD
-
c f51 c2 4f
-
425 a
-
46 3b"
,
 
  
"q uan tit y"
: 
1
,
 
  
"m rp"
: 
1 00
,
 
  
"p ric e"
: 
99
,
 
  
"t ota lMR P"
: 
1 00
,
 
  
"t ota lPr ic e"
: 
99
,
 
  
"v ari ant Na me"
: 
"TE ST _PR OD UCT _2_ D P_A PIS I NR 100 "
,
 
  
"p rod uct Na me"
: 
"TE ST _PR OD UCT _2_ D P_A PIS "
,
 
  
"v ari ant Di spl ay Nam e"
: 
Q hee Q
,
 
  
"p rod uct Di spl ay Nam e"
: 
" TE ST_ PRO D UCT _2_ DP _AP IS"
,
 
  
"a tta chm en ts"
: [
 
   
"
ht tps :/ /st or age .g oog le api s.c o m/e xlr 8
-
ass ets /v ouc her _b ulk _u plo ad s/d ef aul t_v o uch er. jp g
"
 
  
],
 
  
"m obi leN um ber s"
: 
n ul l
,
 
  
"v ouc her s"
: [
 
   
{
 
    
" vou ch erC od e"
: 
" 787 76 667 "
,
 
    
" vou ch erP in "
: 
"T 6R9
-
Q 3M8
-
C4 V VB1 200 "
,
 
    
" exp ir ati on Dat e"
: 
" 20 28
-
01
-
0 2T0 0:0 0: 00Z "
 
   
}
 
  
],
 
  
"f ulf ill me ntS ta tus "
: 
"F UL FIL LED "
,
 
  
"a llo cat ed Qty "
: 
1
,
 
  
"f ulf ill ed Qty "
: 
1
 
  
}
 
  
]
 
}
 
 
R espo nse Schema
 
Th e res p o ns e s ch ema is  id en tical to  
Get Ord er byI D
.  S ee th at p ag ef o r d etailed  f ield  
d es crip tio n s .
 


Erro rR espo nses
 
Order Not F ound
 
{
 
  
" err or "
: 
"or de rn ot fo un df or ex ter n al ref er enc e: or der
-
07
-
09
-
202 5"
,
 
  
" err Co de"
: 
" RE COR D_ NOT _F OUN D"
 
}
 
 
Use Cases
 
1 .  Customer Servi c e Inte gra ti o n
 
Qu ickly lo o k up o rd ers wh en  cu s to mers p ro vid e th eir ref eren ce n u mbers .
 
2 .  Interna l System Sy nc hroni z a ti on
 
S yn c o rd er s tatu s  with yo ur in tern al s ys tems u s ing  you ro wn  ref eren ce I Ds .
 
3 .  Web hook  Proc essi ng
 
Up d ate o rd er s tatu s in  yo u r s ys tem wh en receivin g  webh o o ks  with  extern al ref eren ces .
 
I ntegration Exa mpl e
 
// Exa mp le: Ch ec ko rd er st atu s by ext e rna lr ef ere nce
 
asy nc
 
fu nct ion
 
c hec kO rde rS tat us
(ex ter n alR efI D) {
 
  
t ry
 
{
 
  
co ns t
 
r esp on se = 
awa it
 
fe tc h
(
 
  
`
$ {ba seU rl }
/o rd ers /b 2b/ de liv ery
-
par tne rs /
${ dpI D}
/ex te rna lr ef/
${ ext ern a lRe fID }
`
,
 


   
{
 
   
hea der s
: {
 
    
"x
-
c li ent
-
i d"
: c lie nt Id,
 
    
"x
-
c li ent
-
s ecr et "
: cl ien tSe c ret ,
 
   
},
 
  
}
 
  
);
 
 
  
if
 
( !re spo ns e.o k) {
 
  
co nst
 
er ro r=  
a wai t
 
res po nse .
js o n
() ;
 
  
if
 
(e rro r. err Co de == = 
" RE COR D_N O T_F OUN D"
) {
 
   
con sol e.
log
(
" Ord er no t fou nd"
);
 
   
ret urn
 
n ull
;
 
  
}
 
  
th row
 
ne w
 
Err or (
`A PI Er ro r: 
${e r ror .er ro r}
`
);
 
  
}
 
 
  
co ns t
 
o rde r = 
a wa it
 
re spo ns e.
j son
( );
 
 
  
// H and le di ffe re nt or der s tat es
 
  
sw it ch
 
(or de r.s ta tus ) {
 
  
ca se
 
"CO MP LET ED "
:
 
   
if
 
(or de r.f ul fil lm ent St atu s= = = 
" FUL FI LLE D"
) {
 
    
a wai t
 
dow nl oad Or der As set s
(o r der );
 
   
}
 
   
bre ak
;
 
  
ca se
 
"FA IL ED"
:
 
   
awa it
 
ha ndl eF ail ed Ord er
(or der ) ;
 
   
bre ak
;
 
  
ca se
 
"PR OC ESS IN G"
:
 
   
// Sch ed ule a not he rc he ck lat e r
 
   
set Tim eo ut
( () =>  
c hec kO rde rSt a tus
(ex te rna lRe fI D),  
3 000 0
);
 
   
bre ak
;
 
  
}
 
 
  
re tu rn
 
ord er ;
 
  
} 
ca tc h
 
( err or ){
 
  
co ns ole .
er ro r
(
" Er ror c hec ki ng ord e rs tat us :"
, er ro r);
 
  
th ro w
 
e rro r;
 


  
}
 
}
 
 
B est Practices
 
1.
 
C onsist e nt  Re fe re nce s
: Us e a con s is ten t fo rm at fo r you r extern al ref eren ce I D s
 
2.
 
E rror H a nd l ing
: Always h an d le th e cas e wh ere ord ers  are no t fo u nd
 
3.
 
S t at u sP ol l ing
: I mp lemen t in tellig en t p o llin g  fo rp en d in g o rd ers
 
4.
 
Logging
:  L o g all o rd er loo ku ps f o r au d it trails