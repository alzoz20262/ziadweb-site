
const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({limit:"6mb"}));
app.use(express.static(path.join(__dirname,"public")));

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM_ID = process.env.VERCEL_TEAM_ID || "";
const PORT = process.env.PORT || 3000;

function apiUrl(endpoint){
  return "https://api.vercel.com"+endpoint+
    (TEAM_ID
      ? (endpoint.includes("?")?"&":"?")+"teamId="+encodeURIComponent(TEAM_ID)
      : "");
}

async function vercel(endpoint,options={}){
  const response=await fetch(apiUrl(endpoint),{
    ...options,
    headers:{
      Authorization:"Bearer "+TOKEN,
      "Content-Type":"application/json"
    }
  });

  const data=await response.json().catch(()=>({}));

  if(!response.ok){
    throw new Error(
      data.error?.message || data.message || "Vercel API error "+response.status
    );
  }

  return data;
}

function cleanName(value){
  return String(value||"z-project")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g,"-")
    .replace(/-+/g,"-")
    .replace(/^-|-$/g,"")
    .slice(0,52)||"z-project";
}

function validateFiles(files){
  if(!Array.isArray(files)||!files.length)
    throw new Error("No files received.");

  if(files.length>500)
    throw new Error("Maximum 500 files.");

  let total=0;
  const names=new Set();

  for(const item of files){
    if(!item.file||typeof item.data!=="string")
      throw new Error("Invalid file data.");

    const name=item.file.replace(/\\/g,"/");

    if(
      name.startsWith("/")||
      name.split("/").includes("..")||
      name.includes("\0")
    )throw new Error("Invalid file path.");

    if(names.has(name))throw new Error("Duplicate file: "+name);
    names.add(name);

    if(!/^[a-zA-Z0-9._/@+ -]+$/.test(name))
      throw new Error("Unsupported filename.");

    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(item.data))
      throw new Error("Invalid Base64 data.");

    total+=Buffer.from(item.data,"base64").length;
  }

  if(total>4*1024*1024)
    throw new Error("Project limit is 4 MB in this version.");

  if(!names.has("index.html"))
    throw new Error("index.html must be in the project root.");
}

app.post("/api/deploy",async(req,res)=>{
  try{
    if(!TOKEN)
      return res.status(500).json({error:"Vercel token is missing on server."});

    const files=req.body.files;
    validateFiles(files);

    const name=cleanName(req.body.name);

    const deployment=await vercel(
      "/v13/deployments?skipAutoDetectionConfirmation=1&forceNew=1",
      {
        method:"POST",
        body:JSON.stringify({
          name,
          files,
          target:"production",
          projectSettings:{
            framework:null
          }
        })
      }
    );

    if(!deployment.id||!deployment.url)
      throw new Error("Vercel did not return a deployment.");

    let state=deployment.readyState;
    let latest=deployment;

    for(let i=0;i<60;i++){
      if(state==="READY")break;

      if(state==="ERROR"||state==="CANCELED")
        throw new Error("Vercel deployment failed: "+state);

      await new Promise(resolve=>setTimeout(resolve,3000));

      latest=await vercel(
        "/v13/deployments/"+encodeURIComponent(deployment.id)
      );

      state=latest.readyState;
    }

    if(state!=="READY")
      throw new Error("Deployment is still processing. Please try again.");

    res.json({
      success:true,
      url:"https://"+latest.url,
      deploymentId:latest.id
    });

  }catch(error){
    console.error(error);
    res.status(500).json({error:error.message||"Deployment failed."});
  }
});

app.listen(PORT,()=>{
  console.log("Z Platform running on port "+PORT);
});

