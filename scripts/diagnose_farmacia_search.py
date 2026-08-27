#!/usr/bin/env python3
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

BASE='https://farmaciapopularonline.cl'
URL=BASE+'/consultor?farmacia=cerro%20navia'
H={'User-Agent':'Mozilla/5.0','Accept-Language':'es-CL,es;q=0.9'}
r=requests.get(URL,timeout=45,headers=H)
r.raise_for_status()
print('STATUS',r.status_code,'LEN',len(r.text))
s=BeautifulSoup(r.text,'html.parser')
for sc in s.find_all('script'):
    src=sc.get('src')
    if src and 'ScriptConsultor' in src:
        js_url=urljoin(URL,src)
        print('CONSULTOR_JS',js_url)
        jr=requests.get(js_url,timeout=45,headers=H)
        jr.raise_for_status()
        print(jr.text[:20000])

# Also print HTML elements likely used by the search script.
for tag in s.find_all(['input','button','select']):
    attrs=' '.join(f'{k}={v}' for k,v in tag.attrs.items())
    txt=tag.get_text(' ',strip=True)
    if any(k in (attrs+' '+txt).lower() for k in ['buscar','filtro','medicamento','farmacia','bodega']):
        print('ELEMENT',tag.name,attrs,txt)
