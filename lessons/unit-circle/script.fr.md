---
title: Le cercle unité
language: fr
---

@scene(circle)
@chapter(Le cercle et l'angle)

Voici un cercle de rayon un. Le point rouge est repéré par un angle,
qu'on appelle @cue(show.thetaLabel = true) thêta. Regardez ce qui se
passe quand on le fait @cue(theta -> 6.2832, over: 4s, ease: inOutCubic)
varier : le point fait le tour complet du cercle.

@show(projection) Projetons maintenant ce point sur l'axe horizontal.
La longueur obtenue, c'est @cue(show.cosLabel = true) le cosinus de
thêta. @board(cosdef: $x = \cos\theta$)

@pause(prompt: "Déplacez le point rouge vous-même et observez le cosinus.")

@cue(theta -> 1.5708, over: 2s) Reprenons. À quatre-vingt-dix degrés,
le cosinus vaut zéro.
