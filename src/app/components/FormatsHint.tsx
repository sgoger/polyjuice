/** Formats acceptés par « Anonymiser », et pourquoi les anciens formats Office sont refusés. */
export function FormatsHint() {
  return (
    <>
      Formats : .docx, .pptx, .xlsx (et leurs variantes avec macros .docm, .pptm, .xlsm), .pdf, .md, .txt.
      <details className="mt-1">
        <summary className="cursor-pointer underline">Et les .doc, .xls, .ppt ?</summary>
        <span className="mt-1 block">
          Ce sont les anciens formats binaires d'Office 97-2003. polyjuice modifie les documents Office directement dans
          leur XML, sans toucher au reste (mise en forme, images, graphiques) ; les formats binaires n'ont pas cette
          structure. Ouvrez le fichier dans Word, Excel ou PowerPoint, Fichier → Enregistrer sous → .docx, .xlsx ou
          .pptx, puis déposez ce fichier.
        </span>
        <span className="mt-1 block">
          Même chose pour .rtf, .odt, .ods, .odp et .csv : enregistrez-les d'abord au format .docx, .xlsx ou .pptx.
        </span>
      </details>
    </>
  );
}
