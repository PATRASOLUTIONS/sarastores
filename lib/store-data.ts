export interface Store {
  id: string
  name: string
  address: string
  city: string
  region: string
  phone: string
  hours: string
  isOpen: boolean
  latitude?: number
  longitude?: number
  image?: string
  state?: string
  pincode?: string
  email?: string
  /** Original Google Maps share link, used for the Directions action. */
  mapUrl?: string
}

export const regions = ["Bangalore", "Mysore", "Hubballi", "Hospet", "Ballary", "Shivamogga", "Hassan", "Dharwad"]

export const stores: Store[] = [
  {
    "id": "1",
    "name": "MOBILE STORE - BEGUR ROAD",
    "address": "No.4/7, Shop No. 2, Ground Floor, HCR Arcage,,Hongasandra Village,Begur Hobli,Bangalore - 560068.",
    "city": "Bangalore",
    "region": "BEGUR ROAD",
    "phone": "9076673131",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "2",
    "name": "MOBILE STORE - CHANDRA LAYOUT",
    "address": "#39. 3rd Cross, 1st Main, 2nd Stage,1st Phase, Chandra Layout,Bangalore - 560040.",
    "city": "Bangalore",
    "region": "CHANDRA LAYOUT",
    "phone": "9988557715",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "3",
    "name": "MOBILE STORE - HEGANAHALLI ROAD",
    "address": "Ground and First Floor, No.182, 9th Cross, Hegganahalli Main Road, Hegganahalli, Bengaluru Urban, Karnataka, 560091",
    "city": "Bangalore",
    "region": "HEGANAHALLI ROAD",
    "phone": "9852551199",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "4",
    "name": "MI STUDIO JAYANAGAR",
    "address": "No. 1288/12, 25th Main Road,Jayanagar 9th Block,,Bangalore - 560069.",
    "city": "Bangalore",
    "region": "JAYANAGAR",
    "phone": "9148944894",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "5",
    "name": "MOBILE STORE - MAGADI ROAD",
    "address": "#27, RP Complex, 6th Cross Corner,Magadi Road, (Near Magadi Road Metro Station),Bangalore - 560023.",
    "city": "Bangalore",
    "region": "MAGADI ROAD",
    "phone": "9620204044",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "6",
    "name": "MOBILE STORE - NAGARBHAVI",
    "address": "No. 64, Srisha Complex, 6th Cross, 6th Block,2nd Stage, Opposite BDA Complex, Nagarabhavi,,Bangalore - 560072.",
    "city": "Bangalore",
    "region": "NAGARBHAVI",
    "phone": "9620209044",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "7",
    "name": "ELECTRONIC STORE - HEBBAGODI 2",
    "address": "PROPERTY NO 71/2, SHOP NO 4, SRIDEVI COMPLEX, ANEKUL TALUK, HEBBAGODI,Bengaluru, Bengaluru Urban, Karnataka, 560099",
    "city": "Bangalore",
    "region": "HEBBAGODI 2",
    "phone": "9513551634",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "8",
    "name": "MOBILE STORE - CHANDAPURA",
    "address": "Floor at Site No. 748/658, Shop No.1 and 2 in Ground, SMP complex, Situated at Opp. Umapathy Garage, Anekal Road, Chandrapur Town, Anekal Taluk, Bengaluru Rural, Karnataka, 560099",
    "city": "Bangalore",
    "region": "CHANDAPURA",
    "phone": "9620209066",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "9",
    "name": "MOBILE STORE - BOMMASANDRA",
    "address": "shop No.1&2, Ward No 2, Shop No.1&2 Jantha Colony,,Bommasandra, Opposite D-Mart, Near Metro Station, Bommasandr,Bangalore - 560099.",
    "city": "Bangalore",
    "region": "BOMMASANDRA",
    "phone": "9620209077",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "10",
    "name": "MOBILE STORE - GOLLARAHATTI",
    "address": "No. 60, Manapuram Gold Loan Building, Near Nice Road,Doddagollarahatti, Magadi Main Road,Bangalore - 560091.",
    "city": "Bangalore",
    "region": "GOLLARAHATTI",
    "phone": "9854055405",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "11",
    "name": "ELECTRONICS STORE - PEENYA 2ND STAGE",
    "address": "No. 117/1, Ramaiah Layout, Rajgopal Nagar,Peenya 2nd stage, Opp to Hotel Sri Ram Food Corner,Bangalore - 560091.",
    "city": "Bangalore",
    "region": "PEENYA 2ND STAGE",
    "phone": "9620206099",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "12",
    "name": "MOBILE STORE - RAJAJI NAGAR",
    "address": "No.706, 42\"d Cross,,3rd Block, Rajajinagar,Bangalore - 560010.",
    "city": "Bangalore",
    "region": "RAJAJI NAGAR",
    "phone": "9620204600",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "13",
    "name": "MOBILE STORE - BASAVAKALYANA",
    "address": "Ground floor, NO 23, MIG II Near Durge Hospital, Main Road, Near Durge Hospital, KHB,Colony, Basavakalyan, Bidar, Karnataka, 585327",
    "city": "Basavakalyana",
    "region": "Basavakalyana",
    "phone": "9513551599",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "14",
    "name": "MOBILE STORE - HOSPET",
    "address": "256, ACHAR HOSPITAL, Station Road, ACHAR HOSPITAL, 4TH WARD, Hosapete,Vijayanagara, Karnataka, 583201",
    "city": "Hospet",
    "region": "Hospet",
    "phone": "9513551598",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "15",
    "name": "MOBILE STORE - BALLARI-2",
    "address": "SRI KMD CSIT DHARWAD CSI Shopping Complex Shop,Parvathi Nagar Ballary Shop No 1 & 2 Ground Floor,Ballary, Karnataka -583103",
    "city": "Ballary",
    "region": "Ballary",
    "phone": "9513551591",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "16",
    "name": "MOBILE STORE - HUBBALLI",
    "address": "GROUND FLOOR, NO. 06, LAKSHMI RAMAKRISHNA SQUARE, Coen Road, Hubballi,Dharwad, Karnataka, 580020",
    "city": "Hubballi",
    "region": "Hubballi",
    "phone": "9513551594",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "17",
    "name": "MOBILE STORE - HONGASANDRA",
    "address": "NO. 93 10th A main, KNR Building, APR Kalyana Mantapa Cross, Hongasandra, Begur MainRoad, Bengaluru, Bengaluru Urban, Karnataka, 560068",
    "city": "Bangalore",
    "region": "HONGASANDRA",
    "phone": "9513551595",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "18",
    "name": "MOBILE STORE - CHINTHAMANI",
    "address": "Prajawal Nilaya, 3rd Main 2nd Cross Anjani Extension 6th Ward, Chintamani, Chikkaballapur,Karnataka, 563125",
    "city": "Chinthamani",
    "region": "Chinthamani",
    "phone": "9513551592",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "19",
    "name": "MOBILE STORE - BIJAPURA",
    "address": "Survey No 983/B/2, S S Road, Bijapur, Vijayapura, Vijayapura, Karnataka, 586101",
    "city": "Bijapur",
    "region": "Bijapur",
    "phone": "9513551632",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "20",
    "name": "MOBILE STORE - YELAHANKA",
    "address": "No.2341, 3rd phase, Khb colony, Yelahanka New Town, Yelahanka, Bengaluru, Bengaluru Urban, Karnataka, 560064",
    "city": "Bangalore",
    "region": "YELAHANKA",
    "phone": "9513551633",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "21",
    "name": "MOBILE STORE - HONGASANDRA 2",
    "address": "Shop no.254, Ground floor, MP reddy complex, hongansandra, begur main road, Bengaluru,Bengaluru Urban, Karnataka, 560068",
    "city": "Bangalore",
    "region": "HONGASANDRA 2",
    "phone": "9620209088",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "22",
    "name": "MOBILE STORE - HEBBAGODI",
    "address": "15/46, Veerabadhrappa Building, Near B.J. Bhavan, Hebbagodi ,Hebbagodi CMC, Ward No.  22, Hebbagodi, Anekal Taluk,,Bangalore - 560099.",
    "city": "Bangalore",
    "region": "HEBBAGODI",
    "phone": "9620209055",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "23",
    "name": "MOBILE STORE - GANGAVATI",
    "address": "Survey No 2-24-75, Mahaveer circle,Lg road, Gangawati, Koppal, Karnataka, 583227",
    "city": "Gangavati",
    "region": "Gangavati",
    "phone": "9513551620",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "24",
    "name": "MOBILE STORE - SHIMOGA",
    "address": "Shop no 3, Modern talkies building, BH Road, Shivamogga, Shivamogga, Karnataka, 577201",
    "city": "Shivmogga",
    "region": "Shivmogga",
    "phone": "9620202844",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "25",
    "name": "MOBILE STORE - HASSAN 2",
    "address": "SHOP NO. 01, SRS BUILDING, NEAR NR CIRCLE, BM ROAD, Hassan, Hassan, Karnataka, 573201",
    "city": "Hassan",
    "region": "Hassan",
    "phone": "9513551626",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "26",
    "name": "MOBILE STORE - HAVERI",
    "address": "Shop No 3- Site No 3341/25C, Lakshmi Complex, PB Road, Haveri -581110",
    "city": "Haveri",
    "region": "Haveri",
    "phone": "9513551625",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "27",
    "name": "MOBILE STORE - JAYANAGAR 2",
    "address": "No 1820/A old, new 12/A 25th main,41st cross 9th block,Bangalore - 560041.",
    "city": "Bangalore",
    "region": "JAYANAGAR 2",
    "phone": "9513551628",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "28",
    "name": "MOBILE STORE - HOSKOTE",
    "address": "Shop No.4 NSP Arcade,K R Road Opp. to TAPCM Society,Hoskote - 562114.",
    "city": "Bangalore",
    "region": "HOSKOTE",
    "phone": "9513551629",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "29",
    "name": "MOBILE STORE - RAJAJI NAGAR 2",
    "address": "NO 129 Old CTC No 184, SANIHA, 19th main 1 block, Rajaji Nagar, Bengaluru, Bengaluru Urban, Karnataka, 560010",
    "city": "Bangalore",
    "region": "RAJAJI NAGAR 2",
    "phone": "9513551622",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "30",
    "name": "MOBILE STORE - DHARWAD",
    "address": "891, trapasol, tikare road, Line Bazar Road, Hosayallapur, Dharwad, Dharwad, Karnataka,580001",
    "city": "Dharwad",
    "region": "Dharwad",
    "phone": "9513551623",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "31",
    "name": "MOBILE STORE - NANJANGUD 1",
    "address": "st Flore, No 3401/A, Srikanteshwara arcade, MGS Road, Nanjangud Cross, Nanjangud, Mysuru, Karnataka, 571301",
    "city": "Nanjangud",
    "region": "Nanjangud",
    "phone": "9620202842",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "32",
    "name": "MOBILE STORE - HUNSUR",
    "address": "Ground Floor, 01, Commercial Building, 5th Cross, BM Road, Hunsur, Near Maruthi Petrol Bunk, Hunsur, Mysuru, Karnataka, 571105",
    "city": "Hunsur",
    "region": "Hunsur",
    "phone": "9620202841",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "33",
    "name": "MOBILE STORE - RAMDURGA",
    "address": "GROUND FLORE, No 42/B, NAVI PETH, RAMDURGA, governmental hospital, RAMDURGA, Ramdurg, Belagavi, Karnataka, 591123",
    "city": "Ramdurga",
    "region": "Ramdurga",
    "phone": "9620202844",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "34",
    "name": "MOBILE STORE - BAGEPALLI",
    "address": "Ground Floor, No 32 P.I.D No 10-4-96/A, DVG Road, kasaba Hobli, Bagepalli, Chikkaballapur, Karnataka, 561207",
    "city": "Bagepalli ",
    "region": "Bagepalli ",
    "phone": "9620202845",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "35",
    "name": "MOBILE STORE - BOMMNAHALLI",
    "address": "Ground Floor, No 286/1, Begur Main Road, Bommanahalli, Bengaluru, Bengaluru Urban, Karnataka, 560068",
    "city": "Bangalore",
    "region": "Bommanahalli",
    "phone": "9620203966",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "36",
    "name": "MOBILE STORE - CHIKKABALLPUR",
    "address": "Ground Floor, No 1045/960 NO 23, B B Road, Chikballapur Rural, Chikkaballapur, Chikkaballapur, Karnataka,562101",
    "city": "Chikkballapur",
    "region": "Chikkballapur",
    "phone": "9071410978",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "37",
    "name": "MOBILE STORE - KAMMANAHALLI",
    "address": "Ground Floor, No 2392/3, Neharu Road, Old Banaswadi Police station, Kammanahalli, Bengaluru, Bengaluru Urban, Karnataka,560084",
    "city": "Bangalore",
    "region": "Kammanahalli",
    "phone": "9071410977",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "38",
    "name": "MOBILE STORE - MANDYA 2",
    "address": "SR Complex, No D3 /1576/1-1A, V V Road, Mandya 2nd Stage Industrial Estate, Mandya, Mandya, Karnataka,571401",
    "city": "Mandya ",
    "region": "Mandya ",
    "phone": "9071410976",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "39",
    "name": "MOBILE STORE - KOPPAL",
    "address": "Ground fLOOR, ward no 4 Block no 1, Jawahar Road, Koppal, Koppal, Koppal, Karnataka,583231",
    "city": "Koppal",
    "region": "Koppal",
    "phone": "9071410965",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "40",
    "name": "MOBILE STORE - SRINIVASAPUR",
    "address": "108 Ground Foor, No 71/71, MG Road, Srinivasapura, Srinivaspur, Kolar, Karnataka ",
    "city": "SRINIVASAPUR",
    "region": "SRINIVASAPUR",
    "phone": "9071410966",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "41",
    "name": "MOBILE STORE - CHINTHAMANI 2",
    "address": "#90, Banga lore Road East Side,NR Extension,Chintamani-563125",
    "city": "Chinthamani",
    "region": "CHINTHAMANI",
    "phone": "9071410964",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "42",
    "name": "MOBILE STORE - RAICHUR",
    "address": "Ground Floor, No 1-10-53 & 1-10-53/1, Station Road, Raichur, Raichur, Raichur, Karnataka, 584101",
    "city": "RAICHUR",
    "region": "RAICHUR",
    "phone": "9071410969",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "43",
    "name": "MOBILE STORE - MULBAGAL",
    "address": "Municipal No.4646/4662/3840/3103,New No.5438/1,5367/1,4662/1,Mulbaga l Town,Kolar-563131",
    "city": "MULBAGAL",
    "region": "MULBAGAL",
    "phone": "9071410962",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "44",
    "name": "MOBILE STORE - GADAG",
    "address": "Ground Floor, No 478/B, Station Road, Ambedkar Nagar Gadag, Gadag Betageri, Gadag, Karnataka, 582101",
    "city": "GADAG",
    "region": "GADAG",
    "phone": "9071410963",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "45",
    "name": "MOBILE STORE - HASSAN 3",
    "address": "Mezzanine floor,391, OPPOSITE TO BSNL BHAVAN, NEXT TO SMART BAZAAR, BM ROAD, HANUMAN TOWERS, Hassan, Hassan, Karnataka, 573201",
    "city": "Hassan",
    "region": "Hassan",
    "phone": "9071410970",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "46",
    "name": "MOBILE STORE - HAVERI 2",
    "address": "0, No 3350, Pandith Hospital Road, Opp Med plus, Haveri, Haveri, Haveri, Karnataka, 581110",
    "city": "Haveri",
    "region": "Haveri",
    "phone": "9071410971",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "47",
    "name": "MOBILE STORE - DODDABALLAPUR",
    "address": "Ground Floor, No 2673, Chikkpete, doddaballapura, Bengaluru, Bengaluru Rural, Karnataka, 561203",
    "city": "doddaballapura",
    "region": "doddaballapura",
    "phone": "9071410972",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "48",
    "name": "MOBILE STORE - SUNKADAKATTE",
    "address": "Ground Floor, No 10/10, srigandada kaval Sunkadakatte, Magadi Road Area, Bengaluru, Bengaluru Urban, Karnataka,560091 ",
    "city": "Bangalore",
    "region": "Sunkadakatte",
    "phone": "9071410973",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "49",
    "name": "MOBILE STORE-Chamarajanagar",
    "address": "Ground Floore, 0, CV Raman Building, Deviation Road Next to Medplus Pharmacy, Opp Mahesh Gas Service, Chamarajanagar, Chamarajanagar, Chamarajanagar, Karnataka, 571313",
    "city": "Chamarajanagar",
    "region": "Chamarajanagar",
    "phone": "9071410958",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "50",
    "name": "MOBILE STORE - YESWANTHPUR-2",
    "address": "Ground Floor, No 4/11,1st Main Road Gokula, 1st Stage, 4th Phase, Yeshwantpur, Banglaore- 560022",
    "city": "Bangalore",
    "region": "YESWANTHPUR",
    "phone": "9071410959",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "51",
    "name": "MOBILE STORE - DEVANAHALLI",
    "address": "302/1, 70/67/3267/611, Na, B B ROAD, Opp Jain Temple, Bengaluru Signature Business Park,Devanahalli, Bengaluru, Bengaluru Rural, Karnataka, 562110",
    "city": "Bangalore",
    "region": "DEVANAHALLI",
    "phone": "9620209522",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "52",
    "name": "MOBILE STORE - ELITE",
    "address": "Full Building, No 1/2F, Chamaraja Mohalla, Saraswathipuram, Kantharaja Urs Road, Mysuru,Mysuru, Karnataka, 570009",
    "city": "Mysore",
    "region": "MOBILE STORE",
    "phone": "9620207855",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "53",
    "name": "MOBILE STORE-HOLALKERE",
    "address": "Ground Floor, No 2-3-56B, C B MAIN RAOD, Holalkere, Holalkere Rural, Chitradurga, Karnataka, 577526",
    "city": "Chitradurga",
    "region": "MOBILE STORE",
    "phone": "9071410968",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  },
  {
    "id": "54",
    "name": "MOBILE STORE-Kolar",
    "address": "Ward No. 20, MB Road, M.B.Road, Kolar, Kolar, Karnataka, 563101",
    "city": "Kolar",
    "region": "MOBILE STORE",
    "phone": "7338545080",
    "hours": "9:00 AM - 9:00 PM",
    "isOpen": true
  }
]