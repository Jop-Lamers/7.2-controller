# 7.2-controller

## Grijpmachine + Controller

Dit project gebruikt alleen de PHP-pagina's:

- `machine.php`: de grijpmachine met zwaartekracht-simulatie.
- `controller.php`: de bediening om de grijpmachine live te besturen.

## Starten

1. Start Apache via XAMPP.
2. Open `http://localhost/7.2-controller/machine.php`.
3. Open daarna `http://localhost/7.2-controller/controller.php` in een tweede tab of venster.
4. Gebruik de joystick en knop op de controller om de klauw te bedienen.

## Telefoon + laptop verbinden

1. Zorg dat telefoon en laptop op hetzelfde wifi-netwerk zitten.
2. Zoek het IP-adres van je laptop (bijvoorbeeld `192.168.1.120`).
3. Open op de laptop: `http://192.168.1.120/7.2-controller/machine.php`.
4. Open op de telefoon: `http://192.168.1.120/7.2-controller/controller.php`.

De controller en machine praten nu via de XAMPP-server (`api/state.php` en `api/update-state.php`) in plaats van alleen via browser-tab communicatie.

## Smooth tips

- Houd Apache aan tijdens het spelen.
- Gebruik dezelfde URL-host op beide apparaten (dus niet laptop op `localhost` en telefoon op een ander adres).
- Gebruik bij voorkeur 5 GHz wifi voor minder vertraging.

## Besturing

- Joystick links-rechts: beweegt de klauw horizontaal.
- Grijp-knop: de klauw gaat automatisch omlaag, sluit, en gaat weer omhoog zoals op de kermis.
- Laat vallen-knop: opent de klauw direct zodat je de munt/bal kunt droppen.

## Troubleshooting

**Grijper werkt niet goed?**

- Grijper is nu 2x groter. Hij moet veel beter balletjes pakken.
- Test lokaal eerst (twee tabs, hetzelfde scherm): dit werkt altijd.
- Als grijper nog niet werkt, check Console (F12) voor errors.

**Telefoon + laptop niet verbonden?**

1. **Test eerst lokaal** - open machine.php en controller.php in twee tabs op hetzelfde apparaat. Dit werkt altijd.
2. **Check IP-adres** - op laptop: open `ipconfig` (Windows) of `ifconfig` (Mac/Linux) en zoek het `192.168.x.x` adres.
3. **Zelfde host op beide apparaten** - gebruik niet `localhost` op laptop én `192.168.x.x` op telefoon. Doe beide met dezelfde IP.
4. **Browser-console checken** - druk F12, ga naar "Console" tab:
   - **Controller**: Zoek naar "[Controller]" berichten met je controllerId.
   - **Machine**: Zoek naar "[Machine]" berichten, zie je "Controller verbonden (netwerk)"?
   - Errors verschijnen rood.
5. **Firewall** - check of je router/firewall de communicatie niet blokkeert. XAMPP moet inbound-traffic toestaan.
6. **Statebestand** - controleer dat `data/state.json` schrijfbaar is voor PHP.
7. **Refresh** - refresh beide pagina's na het wijzigen van IP.

Het werkt altijd lokaal (twee tabs). Cross-device werkt als beide apparaten dezelfde XAMPP-server kunnen bereiken.
