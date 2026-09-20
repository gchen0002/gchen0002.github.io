# Footer font

`caveat-footer.woff2` is a subset of the installed @fontsource/caveat
`files/caveat-latin-400-normal.woff2`, containing the visible footer labels
`Résumé GitHub` and their shaping glyphs. It is 5,968 bytes instead of 48,836.
The SIL Open Font License is included here.

If either footer label changes, regenerate the subset with FontTools and Brotli:

```sh
pyftsubset node_modules/@fontsource/caveat/files/caveat-latin-400-normal.woff2 --text="Résumé GitHub" --flavor=woff2 --output-file=src/assets/fonts/caveat-footer.woff2
```

This is an asset preparation step, not a runtime or regular build dependency.
