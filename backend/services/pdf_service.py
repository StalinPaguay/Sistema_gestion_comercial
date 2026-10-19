# ============================================================
# SERVICIO DE GENERACIÓN DE PDF PARA FACTURAS - TECNOMEGA
# ============================================================

from decimal import Decimal
from typing import Any
from models.factura import Factura
from models.detalle_factura import DetalleFactura
from models.pago import Pago
from sqlalchemy.orm import Session


def _escape_pdf_str(text: Any) -> str:
    """Sanitiza y escapa texto para cadenas literales en PDF."""
    if text is None:
        return ""
    s = str(text)
    # Reemplazar caracteres especiales de PDF
    s = s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    # Mapear caracteres acentuados comunes a latin-1 seguro
    replacements = {
        "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
        "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U",
        "ñ": "n", "Ñ": "N", "¿": "", "¡": "", "°": "No.",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")


def generar_pdf_factura(fac: Factura, db: Session) -> bytes:
    """Genera un archivo PDF 1.4 binario válido para la factura dada."""
    detalles = db.query(DetalleFactura).filter(DetalleFactura.FacturaId == fac.FacturaId).all()

    cli = fac.Cliente
    persona = cli.Persona if cli else None
    cliente_nombre = f"{persona.Nombres or ''} {persona.Apellidos or ''}".strip() if persona else "Cliente"
    cliente_id = cli.Identificacion if cli else "Consumidor Final"
    fecha_emision = fac.Fecha.strftime("%d/%m/%Y %H:%M") if fac.Fecha else "-"

    numero = fac.Numero or f"FAC-{fac.FacturaId:06d}"
    estado = fac.Estado or "Emitida"
    subtotal = float(fac.Subtotal or 0.0)
    descuento = float(fac.Descuento or 0.0)
    impuesto = float(fac.Impuesto or 0.0)
    total = float(fac.Total or 0.0)
    taxable_base = max(0.0, subtotal - descuento)
    tax_percent = (impuesto / taxable_base * 100) if taxable_base > 0 else 0.0
    payments = db.query(Pago).filter(Pago.PedidoId == fac.PedidoId).all() if fac.PedidoId else []
    payment_method = ", ".join(
        sorted({f"{p.MetodoPago.Nombre} ({p.Estado})" for p in payments if p.MetodoPago})
    ) or "Sin pago registrado"

    stream: list[str] = []

    # 1. Encabezado principal corporativo
    stream.append("0.09 0.23 0.44 rg")
    stream.append("40 760 515 50 re f")
    stream.append("1 1 1 rg")
    stream.append("BT /F2 16 Tf 55 790 Td (TECNOMEGA STORE) Tj ET")
    stream.append("BT /F1 9 Tf 55 772 Td (RUC: 1792283918001 | Matriz: Quito, Ecuador | Tel: (02) 299-8800) Tj ET")
    stream.append("BT /F2 13 Tf 380 790 Td (FACTURA COMERCIAL) Tj ET")
    stream.append(f"BT /F1 10 Tf 380 772 Td (No: {_escape_pdf_str(numero)}) Tj ET")

    # 2. Caja de información del cliente
    stream.append("0.96 0.97 0.98 rg")
    stream.append("40 680 515 65 re f")
    stream.append("0.85 0.88 0.92 RG 1 w")
    stream.append("40 680 515 65 re s")

    stream.append("0.1 0.15 0.25 rg")
    stream.append("BT /F2 9 Tf 55 725 Td (CLIENTE / RAZON SOCIAL:) Tj ET")
    stream.append(f"BT /F1 9 Tf 200 725 Td ({_escape_pdf_str(cliente_nombre)}) Tj ET")

    stream.append("BT /F2 9 Tf 55 707 Td (RUC / IDENTIFICACION:) Tj ET")
    stream.append(f"BT /F1 9 Tf 200 707 Td ({_escape_pdf_str(cliente_id)}) Tj ET")

    stream.append("BT /F2 9 Tf 55 690 Td (FECHA DE EMISION:) Tj ET")
    stream.append(f"BT /F1 9 Tf 200 690 Td ({_escape_pdf_str(fecha_emision)}) Tj ET")

    stream.append("BT /F2 9 Tf 380 725 Td (ESTADO:) Tj ET")
    stream.append(f"BT /F2 9 Tf 430 725 Td ({_escape_pdf_str(estado)}) Tj ET")
    stream.append("BT /F2 8 Tf 380 690 Td (FORMA DE PAGO:) Tj ET")
    stream.append(f"BT /F1 8 Tf 450 690 Td ({_escape_pdf_str(payment_method)[:18]}) Tj ET")

    # 3. Encabezado de la tabla de detalles
    y = 650
    stream.append("0.12 0.25 0.45 rg")
    stream.append(f"40 {y} 515 20 re f")
    stream.append("1 1 1 rg")
    stream.append(f"BT /F2 9 Tf 50 {y+6} Td (DESCRIPCION DEL PRODUCTO) Tj ET")
    stream.append(f"BT /F2 9 Tf 330 {y+6} Td (CANT) Tj ET")
    stream.append(f"BT /F2 9 Tf 380 {y+6} Td (P. UNIT) Tj ET")
    stream.append(f"BT /F2 9 Tf 440 {y+6} Td (DESC) Tj ET")
    stream.append(f"BT /F2 9 Tf 500 {y+6} Td (TOTAL) Tj ET")

    # 4. Filas de productos
    y -= 18
    stream.append("0.15 0.15 0.2 rg")
    for d in detalles:
        prod_nombre = d.Producto.Nombre if d.Producto else "Producto"
        cant = d.Cantidad
        p_unit = float(d.PrecioUnitario or 0.0)
        desc_val = float(d.DescuentoValor or 0.0)
        line_total = float(d.Total or 0.0)

        stream.append("0.92 0.93 0.95 RG 0.5 w")
        stream.append(f"40 {y-3} 515 0.5 re s")
        stream.append(f"BT /F1 8.5 Tf 50 {y+2} Td ({_escape_pdf_str(prod_nombre)[:45]}) Tj ET")
        stream.append(f"BT /F1 8.5 Tf 335 {y+2} Td ({cant}) Tj ET")
        stream.append(f"BT /F1 8.5 Tf 380 {y+2} Td (${p_unit:.2f}) Tj ET")
        stream.append(f"BT /F1 8.5 Tf 440 {y+2} Td (${desc_val:.2f}) Tj ET")
        stream.append(f"BT /F2 8.5 Tf 500 {y+2} Td (${line_total:.2f}) Tj ET")
        y -= 18

    # 5. Caja de totales
    y -= 12
    stream.append("0.97 0.98 0.99 rg")
    stream.append(f"340 {y-75} 215 75 re f")
    stream.append("0.85 0.88 0.92 RG 1 w")
    stream.append(f"340 {y-75} 215 75 re s")

    stream.append("0.15 0.15 0.2 rg")
    stream.append(f"BT /F1 9 Tf 350 {y-15} Td (SUBTOTAL:) Tj ET")
    stream.append(f"BT /F2 9 Tf 475 {y-15} Td (${subtotal:.2f}) Tj ET")

    stream.append(f"BT /F1 9 Tf 350 {y-30} Td (DESCUENTO:) Tj ET")
    stream.append(f"BT /F2 9 Tf 475 {y-30} Td (-${descuento:.2f}) Tj ET")

    stream.append(f"BT /F1 9 Tf 350 {y-45} Td (IVA ({tax_percent:.2f}%):) Tj ET")
    stream.append(f"BT /F2 9 Tf 475 {y-45} Td (${impuesto:.2f}) Tj ET")

    stream.append("0.09 0.23 0.44 rg")
    stream.append(f"BT /F2 11 Tf 350 {y-65} Td (TOTAL A PAGAR:) Tj ET")
    stream.append(f"BT /F2 11 Tf 475 {y-65} Td (${total:.2f}) Tj ET")

    # 6. Pie de página
    stream.append("0.5 0.55 0.6 rg")
    stream.append("0.85 0.88 0.92 RG 0.5 w")
    stream.append("40 70 515 0.5 re s")
    stream.append("BT /F1 8 Tf 140 55 Td (Comprobante comercial emitido por TECNOMEGA STORE. Gracias por su compra.) Tj ET")
    stream.append("BT /F1 7.5 Tf 175 42 Td (Documento informativo de control para el cliente y la tienda.) Tj ET")

    stream_content = "\n".join(stream)
    stream_bytes = stream_content.encode("latin-1")

    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        f"<< /Length {len(stream_bytes)} >>\nstream\n{stream_content}\nendstream",
    ]

    out = [b"%PDF-1.4\n"]
    offsets = []
    pos = len(out[0])
    for i, o in enumerate(objs):
        offsets.append(pos)
        chunk = f"{i+1} 0 obj\n{o}\nendobj\n".encode("latin-1")
        out.append(chunk)
        pos += len(chunk)

    xref_pos = pos
    xref = f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010d} 00000 n \n"
    out.append(xref.encode("latin-1"))
    trailer = f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n"
    out.append(trailer.encode("latin-1"))

    return b"".join(out)
