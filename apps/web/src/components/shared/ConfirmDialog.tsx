'use client'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <AlertDialog.Popup
          data-testid="modal-confirm-delete"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl"
        >
          <AlertDialog.Title className="text-lg font-semibold text-gray-900">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-gray-500">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Close
              render={
                <Button
                  data-testid="btn-cancel-delete"
                  variant="outline"
                  disabled={isLoading}
                >
                  {cancelLabel}
                </Button>
              }
            />
            <Button
              data-testid="btn-confirm-delete"
              variant="destructive"
              disabled={isLoading}
              onClick={onConfirm}
            >
              {isLoading ? 'Aguarde...' : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
