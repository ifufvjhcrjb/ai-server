import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static("public")); // ai.html

const userFile = "./user.json";
const memoryFile = "./memory.json";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- kata tanya ---
function butuhSearch(text){
  const kataTanya = ["siapa","apa","kapan","dimana","di mana","bagaimana","berapa","kenapa","mengapa","apakah"];
  return kataTanya.some(kata => text.toLowerCase().includes(kata));
}

// --- search Bing ---
async function searchWeb(query){
  try{
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url,{ headers:{ "Ocp-Apim-Subscription-Key": process.env.BING_API_KEY } });
    const data = await res.json();
    return data.webPages?.value?.slice(0,3).map(r=>r.snippet).join("\n") || "";
  }catch(e){ return ""; }
}

// --- register ---
app.post("/register",(req,res)=>{
  const { nama, token } = req.body;
  if(!nama || !token) return res.status(400).json({error:"Nama & token wajib"});
  let users = fs.existsSync(userFile)?JSON.parse(fs.readFileSync(userFile)):[];
  if(users.find(u=>u.token===token)) return res.status(400).json({error:"Token sudah ada"});
  users.push({nama, token});
  fs.writeFileSync(userFile, JSON.stringify(users,null,2));
  res.json({success:true});
});

// --- login ---
app.post("/login",(req,res)=>{
  const { token } = req.body;
  if(!token) return res.status(400).json({error:"Token wajib"});
  let users = fs.existsSync(userFile)?JSON.parse(fs.readFileSync(userFile)):[];
  const user = users.find(u=>u.token===token);
  if(!user) return res.status(401).json({error:"Token tidak valid"});
  res.json({success:true, nama:user.nama});
});

// --- chat ---
app.post("/chat", async (req,res)=>{
  const { token, message } = req.body;
  let users = fs.existsSync(userFile)?JSON.parse(fs.readFileSync(userFile)):[];
  const user = users.find(u=>u.token===token);
  if(!user) return res.status(401).json({error:"Token tidak valid"});

  let memory = fs.existsSync(memoryFile)?JSON.parse(fs.readFileSync(memoryFile)):[];
  let context = butuhSearch(message)?await searchWeb(message):"";

  const today = new Date().toLocaleDateString("id-ID", {day:"numeric",month:"long",year:"numeric"});
  const systemPrompt = `
Kamu adalah Kaii-AI, kecerdasan buatan serba bisa, over power.
Jawablah dengan jelas, ramah, bermanfaat, profesional.
Dibuat oleh @kuro_kaii.
Hari ini: ${today}.
${context?"Informasi hasil pencarian:\n"+context:""}`;

  try{
    const completion = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"system", content:systemPrompt},{role:"user",content:message}],
      max_tokens:500
    });
    const reply = completion.choices[0].message.content;

    memory.push({role:"user", content:message});
    memory.push({role:"assistant", content:reply});
    fs.writeFileSync(memoryFile, JSON.stringify(memory,null,2));

    res.json({reply});
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.listen(PORT,"0.0.0.0",()=>console.log(`🚀 Server AI jalan di port ${PORT}`));