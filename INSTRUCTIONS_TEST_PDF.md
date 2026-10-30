# Instructions pour tester l'upload de PDF

## Étapes de test avec les logs de débogage

1. **Démarrer l'application** :
   ```bash
   npm run dev
   ```

2. **Ouvrir la console du navigateur** :
   - Chrome/Edge : F12 ou Ctrl+Shift+I
   - Firefox : F12 ou Ctrl+Shift+K
   - Aller dans l'onglet "Console"

3. **Aller dans l'onglet Suivi** de l'application

4. **Cliquer sur "Ajouter un ancien devis"**

5. **Sélectionner un fichier PDF** à uploader

6. **Observer les logs dans la console** :
   - Nombre de pages détectées
   - Lignes extraites de chaque page
   - Champs détectés (numéro, date, client, totaux, etc.)
   - Lignes du tableau extraites

7. **Copier les logs** et me les envoyer pour que je puisse :
   - Identifier ce qui ne fonctionne pas
   - Adapter l'algorithme d'extraction à votre format de PDF
   - Corriger les regex et la détection des champs

## Informations à me fournir

Pour améliorer l'extraction, envoyez-moi :

1. Les **logs de la console** après l'upload
2. Une **description du format** de vos devis :
   - Comment est affiché le numéro de devis ?
   - Format de la date ?
   - Comment sont organisées les informations client ?
   - Structure du tableau des lignes (colonnes présentes) ?
   - Comment sont affichés les totaux HT/TTC ?

## Exemple de ce que je cherche

Si votre PDF contient par exemple :
```
DEVIS N° 2024-001
Date : 15/03/2024

Client : M. Dupont
Adresse : 10 rue de la Paix, 75001 Paris

Désignation          Qté  P.U. HT   Total HT
Installation pompe    1    1500,00   1500,00
Main d'oeuvre        3h     50,00     150,00

Total HT : 1650,00 €
TVA 20% : 330,00 €
Total TTC : 1980,00 €
```

Dites-moi si c'est ce format ou un autre.
