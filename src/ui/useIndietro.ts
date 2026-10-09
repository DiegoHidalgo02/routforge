// «Indietro» (IconButton indietro, `claude-design/docs/COMPONENTI.md`): alla schermata precedente; aperta da un
// collegamento diretto, dove nell'app non c'è una schermata precedente, a `altrimenti` (Oggi se non detto). Era scritto
// a mano in nove schermate (audit P3-18).
import { useLocation, useNavigate } from 'react-router';

export function useIndietro(altrimenti = '/'): () => void {
  const navigate = useNavigate();
  const primaSchermata = useLocation().key === 'default';
  return () => void (primaSchermata ? navigate(altrimenti) : navigate(-1));
}
