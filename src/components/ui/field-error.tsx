/** Message d'erreur sous un champ (annoncé aux lecteurs d'écran). */
export function FieldError({ message, id }: { message?: string; id?: string }) {
  return message ? (
    <p id={id} role="alert" className="mb-2 mt-1 text-sm text-danger">
      {message}
    </p>
  ) : null;
}
