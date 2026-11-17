// Countersign's UI strings, kept apart from upstream's catalogs so rebases
// onto upstream rarely conflict. Merged into the catalogs in i18nProvider.ts.
export const englishCountersignMessages = {
  crm: {
    countersign: {
      title: "Countersign",
      description:
        "Ask for work on your records. Nothing changes until you confirm the Plan.",
      request: "Request",
      placeholder: "e.g. Move my deals with no activity for 30 days to lost",
      send: "Send",
      working: "Working: step %{step}",
      unavailable: "Countersign is unavailable right now. Try again.",
      change_count: "%{smart_count} change |||| %{smart_count} changes",
      empty_value: "empty",
      change: {
        update_field: "%{record}: %{field} %{from} → %{to}",
        create_task: '%{record}: new %{type} task "%{text}" due %{dueDate}',
        add_note: '%{record}: new note "%{text}"',
      },
    },
  },
};

export const frenchCountersignMessages = {
  crm: {
    countersign: {
      title: "Countersign",
      description:
        "Demandez du travail sur vos fiches. Rien ne change tant que vous n'avez pas confirmé le Plan.",
      request: "Demande",
      placeholder:
        "ex. Passer en perdu mes affaires sans activité depuis 30 jours",
      send: "Envoyer",
      working: "En cours : étape %{step}",
      unavailable: "Countersign est indisponible pour le moment. Réessayez.",
      change_count:
        "%{smart_count} modification |||| %{smart_count} modifications",
      empty_value: "vide",
      change: {
        update_field: "%{record} : %{field} %{from} → %{to}",
        create_task:
          "%{record} : nouvelle tâche %{type} « %{text} » pour le %{dueDate}",
        add_note: "%{record} : nouvelle note « %{text} »",
      },
    },
  },
};
