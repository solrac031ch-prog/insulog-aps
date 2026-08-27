#!/usr/bin/env python3
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

URL='https://farmaciapopularonline.cl/consultor?farmacia=cerro%20navia'
r=requests.get(URL,timeout=45,headers={'User-Agent':'Mozilla/5.0','Accept-Language':'es-CL,es;q=0.9'})
r.raise_for_status()
print('STATUS',r.status_code,'LEN',len(r.text))
s=BeautifulSoup(r.text,'html.parser')
for i,f in enumerate(s.find_all('form')):
    print('FORM',i,'method=',f.get('method'),'action=',f.get('action'))
    for inp in f.find_all(['input','button','select']):
        print(' ',inp.name,'type=',inp.get('type'),'name=',inp.get('name'),'id=',inp.get('id'),'value=',inp.get('value'),'class=',inp.get('class'))
print('SCRIPTS')
for sc in s.find_all('script'):
    src=sc.get('src')
    if src: print('SRC',urljoin(URL,src))
    txt=(sc.string or sc.get_text(' ',strip=True) or '')
    if any(k in txt.lower() for k in ['ajax','buscar','filtro','medicamento','consultor']):
        print('INLINE',txt[:4000])
print('LINKS containing consultor/filter')
for a in s.find_all('a',href=True):
    h=a['href']
    if any(k in h.lower() for k in ['consult','buscar','filtro','medic']): print(h)
