// ===== MEJORAS SIN TOCAR TU LÓGICA =====

// SCROLL AUTOMÁTICO ENTRE PANTALLAS
const originalNav = window.nav;

window.nav = function(n){
if(originalNav) originalNav(n);

setTimeout(()=>{
const container = document.querySelector('.container');
if(container){
container.scrollIntoView({behavior:"smooth"});
}
},100);
};

// FEEDBACK VISUAL BOTONES
document.addEventListener("click", (e)=>{
if(e.target.classList.contains("btn")){
e.target.style.transform = "scale(0.97)";
setTimeout(()=>{
e.target.style.transform = "scale(1)";
},100);
}
});

// VALIDACIÓN SUAVE INPUT PESO
document.addEventListener("input", (e)=>{
if(e.target.id === "peso-paciente"){
if(e.target.value > 300) e.target.value = 300;
}
});

// AUTOFOCUS INTELIGENTE
document.addEventListener("DOMContentLoaded", ()=>{
const peso = document.getElementById("peso-paciente");
if(peso){
peso.focus();
}
});

// PREVENIR ERRORES SILENCIOSOS
window.addEventListener("error", function(e){
console.warn("Error detectado:", e.message);
});
