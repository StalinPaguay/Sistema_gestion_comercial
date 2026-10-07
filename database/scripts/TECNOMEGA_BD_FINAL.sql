/*
===============================================================================
TECNOMEGA - BASE DE DATOS FINAL
Sistema Web de Gestión Comercial
Motor: Microsoft SQL Server 2022
Backend: Python + FastAPI
===============================================================================

Criterios:
- Modelo normalizado.
- Reglas comerciales parametrizables.
- Integridad referencial y restricciones.
- Inventario basado en movimientos.
- Promociones por producto/categoría/monto mínimo.
- Auditoría de operaciones críticas.
- FastAPI como capa de aplicación.
===============================================================================
*/

IF DB_ID(N'TECNOMEGA') IS NULL
BEGIN
    CREATE DATABASE TECNOMEGA;
END;
GO

USE TECNOMEGA;
GO

SET NOCOUNT ON;
GO

/* ============================================================================
   1. TABLAS PRINCIPALES
   ============================================================================ */

IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Roles
    (
        RolId       INT IDENTITY(1,1) NOT NULL,
        Nombre      VARCHAR(50) NOT NULL,
        Descripcion VARCHAR(255) NULL,
        Estado      BIT NOT NULL CONSTRAINT DF_Roles_Estado DEFAULT 1,
        CONSTRAINT PK_Roles PRIMARY KEY (RolId),
        CONSTRAINT UQ_Roles_Nombre UNIQUE (Nombre)
    );
END;
GO

IF OBJECT_ID(N'dbo.Personas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Personas
    (
        PersonaId INT IDENTITY(1,1) NOT NULL,
        Nombres   VARCHAR(100) NOT NULL,
        Apellidos VARCHAR(100) NOT NULL,
        Email     VARCHAR(150) NULL,
        Telefono  VARCHAR(20) NULL,
        CONSTRAINT PK_Personas PRIMARY KEY (PersonaId),
        CONSTRAINT CK_Personas_Email
            CHECK (Email IS NULL OR Email LIKE '%_@_%._%')
    );
END;
GO

IF OBJECT_ID(N'dbo.Usuarios', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Usuarios
    (
        UsuarioId     INT IDENTITY(1,1) NOT NULL,
        PersonaId     INT NOT NULL,
        RolId         INT NOT NULL,
        PasswordHash  VARCHAR(255) NOT NULL,
        FechaRegistro DATETIME2 NOT NULL
            CONSTRAINT DF_Usuarios_FechaRegistro DEFAULT SYSDATETIME(),
        Estado        BIT NOT NULL
            CONSTRAINT DF_Usuarios_Estado DEFAULT 1,
        CONSTRAINT PK_Usuarios PRIMARY KEY (UsuarioId),
        CONSTRAINT FK_Usuarios_Personas
            FOREIGN KEY (PersonaId) REFERENCES dbo.Personas(PersonaId),
        CONSTRAINT FK_Usuarios_Roles
            FOREIGN KEY (RolId) REFERENCES dbo.Roles(RolId),
        CONSTRAINT UQ_Usuarios_Persona UNIQUE (PersonaId)
    );
END;
GO

IF OBJECT_ID(N'dbo.Clientes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Clientes
    (
        ClienteId      INT IDENTITY(1,1) NOT NULL,
        PersonaId      INT NOT NULL,
        Identificacion VARCHAR(20) NOT NULL,
        Estado         BIT NOT NULL
            CONSTRAINT DF_Clientes_Estado DEFAULT 1,
        FechaRegistro  DATETIME2 NOT NULL
            CONSTRAINT DF_Clientes_FechaRegistro DEFAULT SYSDATETIME(),
        CONSTRAINT PK_Clientes PRIMARY KEY (ClienteId),
        CONSTRAINT FK_Clientes_Personas
            FOREIGN KEY (PersonaId) REFERENCES dbo.Personas(PersonaId),
        CONSTRAINT UQ_Clientes_Persona UNIQUE (PersonaId),
        CONSTRAINT UQ_Clientes_Identificacion UNIQUE (Identificacion)
    );
END;
GO

IF OBJECT_ID(N'dbo.DireccionesCliente', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DireccionesCliente
    (
        DireccionId  INT IDENTITY(1,1) NOT NULL,
        ClienteId    INT NOT NULL,
        Provincia    VARCHAR(100) NULL,
        Ciudad       VARCHAR(100) NULL,
        Direccion    VARCHAR(250) NOT NULL,
        Referencia   VARCHAR(250) NULL,
        CodigoPostal VARCHAR(20) NULL,
        EsPrincipal  BIT NOT NULL
            CONSTRAINT DF_Direcciones_EsPrincipal DEFAULT 0,
        Estado       BIT NOT NULL
            CONSTRAINT DF_Direcciones_Estado DEFAULT 1,
        CONSTRAINT PK_DireccionesCliente PRIMARY KEY (DireccionId),
        CONSTRAINT FK_DireccionesCliente_Clientes
            FOREIGN KEY (ClienteId) REFERENCES dbo.Clientes(ClienteId)
    );
END;
GO

IF OBJECT_ID(N'dbo.Categorias', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Categorias
    (
        CategoriaId INT IDENTITY(1,1) NOT NULL,
        Nombre      VARCHAR(100) NOT NULL,
        Descripcion VARCHAR(255) NULL,
        Estado      BIT NOT NULL
            CONSTRAINT DF_Categorias_Estado DEFAULT 1,
        CONSTRAINT PK_Categorias PRIMARY KEY (CategoriaId),
        CONSTRAINT UQ_Categorias_Nombre UNIQUE (Nombre)
    );
END;
GO

IF OBJECT_ID(N'dbo.Marcas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Marcas
    (
        MarcaId     INT IDENTITY(1,1) NOT NULL,
        Nombre      VARCHAR(100) NOT NULL,
        Descripcion VARCHAR(255) NULL,
        Estado      BIT NOT NULL
            CONSTRAINT DF_Marcas_Estado DEFAULT 1,
        CONSTRAINT PK_Marcas PRIMARY KEY (MarcaId),
        CONSTRAINT UQ_Marcas_Nombre UNIQUE (Nombre)
    );
END;
GO

IF OBJECT_ID(N'dbo.Proveedores', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Proveedores
    (
        ProveedorId   INT IDENTITY(1,1) NOT NULL,
        NombreEmpresa VARCHAR(150) NOT NULL,
        RUC           VARCHAR(20) NOT NULL,
        Contacto      VARCHAR(100) NULL,
        Telefono      VARCHAR(20) NULL,
        Email         VARCHAR(150) NULL,
        Direccion     VARCHAR(250) NULL,
        Estado        BIT NOT NULL
            CONSTRAINT DF_Proveedores_Estado DEFAULT 1,
        CONSTRAINT PK_Proveedores PRIMARY KEY (ProveedorId),
        CONSTRAINT UQ_Proveedores_Nombre UNIQUE (NombreEmpresa),
        CONSTRAINT UQ_Proveedores_RUC UNIQUE (RUC)
    );
END;
GO

IF OBJECT_ID(N'dbo.Productos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Productos
    (
        ProductoId  INT IDENTITY(1,1) NOT NULL,
        CategoriaId INT NOT NULL,
        MarcaId     INT NOT NULL,
        SKU         VARCHAR(50) NOT NULL,
        Nombre      VARCHAR(150) NOT NULL,
        Descripcion VARCHAR(500) NULL,
        Precio      DECIMAL(18,2) NOT NULL,
        Stock       INT NOT NULL
            CONSTRAINT DF_Productos_Stock DEFAULT 0,
        StockMinimo INT NOT NULL
            CONSTRAINT DF_Productos_StockMinimo DEFAULT 5,
        Estado      BIT NOT NULL
            CONSTRAINT DF_Productos_Estado DEFAULT 1,
        CONSTRAINT PK_Productos PRIMARY KEY (ProductoId),
        CONSTRAINT FK_Productos_Categorias
            FOREIGN KEY (CategoriaId) REFERENCES dbo.Categorias(CategoriaId),
        CONSTRAINT FK_Productos_Marcas
            FOREIGN KEY (MarcaId) REFERENCES dbo.Marcas(MarcaId),
        CONSTRAINT UQ_Productos_SKU UNIQUE (SKU),
        CONSTRAINT CK_Productos_Precio CHECK (Precio >= 0),
        CONSTRAINT CK_Productos_Stock CHECK (Stock >= 0),
        CONSTRAINT CK_Productos_StockMinimo CHECK (StockMinimo >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.ProductoProveedor', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductoProveedor
    (
        ProductoId  INT NOT NULL,
        ProveedorId INT NOT NULL,
        CONSTRAINT PK_ProductoProveedor
            PRIMARY KEY (ProductoId, ProveedorId),
        CONSTRAINT FK_ProductoProveedor_Producto
            FOREIGN KEY (ProductoId) REFERENCES dbo.Productos(ProductoId),
        CONSTRAINT FK_ProductoProveedor_Proveedor
            FOREIGN KEY (ProveedorId) REFERENCES dbo.Proveedores(ProveedorId)
    );
END;
GO

IF OBJECT_ID(N'dbo.ImagenesProducto', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ImagenesProducto
    (
        ImagenId    INT IDENTITY(1,1) NOT NULL,
        ProductoId  INT NOT NULL,
        UrlImagen   VARCHAR(500) NOT NULL,
        EsPrincipal BIT NOT NULL
            CONSTRAINT DF_Imagenes_EsPrincipal DEFAULT 0,
        CONSTRAINT PK_ImagenesProducto PRIMARY KEY (ImagenId),
        CONSTRAINT FK_ImagenesProducto_Productos
            FOREIGN KEY (ProductoId) REFERENCES dbo.Productos(ProductoId)
    );
END;
GO

/* ============================================================================
   2. INVENTARIO
   ============================================================================ */

IF OBJECT_ID(N'dbo.TiposMovimientoInventario', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TiposMovimientoInventario
    (
        TipoMovimientoId INT IDENTITY(1,1) NOT NULL,
        Nombre           VARCHAR(50) NOT NULL,
        Descripcion      VARCHAR(255) NULL,
        CONSTRAINT PK_TiposMovimientoInventario PRIMARY KEY (TipoMovimientoId),
        CONSTRAINT UQ_TiposMovimientoInventario_Nombre UNIQUE (Nombre)
    );
END;
GO

IF OBJECT_ID(N'dbo.MovimientosInventario', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MovimientosInventario
    (
        MovimientoId     INT IDENTITY(1,1) NOT NULL,
        ProductoId       INT NOT NULL,
        ProveedorId      INT NULL,
        UsuarioId        INT NOT NULL,
        TipoMovimientoId INT NOT NULL,
        Cantidad         INT NOT NULL,
        Fecha            DATETIME2 NOT NULL
            CONSTRAINT DF_Movimientos_Fecha DEFAULT SYSDATETIME(),
        Motivo           VARCHAR(255) NULL,
        Observacion      VARCHAR(500) NULL,
        CONSTRAINT PK_MovimientosInventario PRIMARY KEY (MovimientoId),
        CONSTRAINT FK_Movimientos_Productos
            FOREIGN KEY (ProductoId) REFERENCES dbo.Productos(ProductoId),
        CONSTRAINT FK_Movimientos_Proveedores
            FOREIGN KEY (ProveedorId) REFERENCES dbo.Proveedores(ProveedorId),
        CONSTRAINT FK_Movimientos_Usuarios
            FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
        CONSTRAINT FK_Movimientos_Tipos
            FOREIGN KEY (TipoMovimientoId)
            REFERENCES dbo.TiposMovimientoInventario(TipoMovimientoId),
        CONSTRAINT CK_Movimientos_Cantidad CHECK (Cantidad <> 0)
    );
END;
GO

/* ============================================================================
   3. CARRITO Y MÉTODOS DE PAGO
   ============================================================================ */

IF OBJECT_ID(N'dbo.Carrito', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Carrito
    (
        CarritoId          INT IDENTITY(1,1) NOT NULL,
        ClienteId          INT NOT NULL,
        FechaActualizacion DATETIME2 NOT NULL
            CONSTRAINT DF_Carrito_Fecha DEFAULT SYSDATETIME(),
        CONSTRAINT PK_Carrito PRIMARY KEY (CarritoId),
        CONSTRAINT FK_Carrito_Clientes
            FOREIGN KEY (ClienteId) REFERENCES dbo.Clientes(ClienteId),
        CONSTRAINT UQ_Carrito_Cliente UNIQUE (ClienteId)
    );
END;
GO

IF OBJECT_ID(N'dbo.DetalleCarrito', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DetalleCarrito
    (
        DetalleCarritoId INT IDENTITY(1,1) NOT NULL,
        CarritoId        INT NOT NULL,
        ProductoId       INT NOT NULL,
        Cantidad         INT NOT NULL
            CONSTRAINT DF_DetalleCarrito_Cantidad DEFAULT 1,
        CONSTRAINT PK_DetalleCarrito PRIMARY KEY (DetalleCarritoId),
        CONSTRAINT FK_DetalleCarrito_Carrito
            FOREIGN KEY (CarritoId) REFERENCES dbo.Carrito(CarritoId),
        CONSTRAINT FK_DetalleCarrito_Producto
            FOREIGN KEY (ProductoId) REFERENCES dbo.Productos(ProductoId),
        CONSTRAINT CK_DetalleCarrito_Cantidad CHECK (Cantidad > 0),
        CONSTRAINT UQ_DetalleCarrito_Producto UNIQUE (CarritoId, ProductoId)
    );
END;
GO

IF OBJECT_ID(N'dbo.MetodosPago', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.MetodosPago
    (
        MetodoPagoId INT IDENTITY(1,1) NOT NULL,
        Nombre       VARCHAR(50) NOT NULL,
        Estado       BIT NOT NULL
            CONSTRAINT DF_MetodosPago_Estado DEFAULT 1,
        CONSTRAINT PK_MetodosPago PRIMARY KEY (MetodoPagoId),
        CONSTRAINT UQ_MetodosPago_Nombre UNIQUE (Nombre)
    );
END;
GO

/* ============================================================================
   4. PROMOCIONES Y PARAMETRIZACIÓN COMERCIAL
   ============================================================================ */

IF OBJECT_ID(N'dbo.Promociones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Promociones
    (
        PromocionId       INT IDENTITY(1,1) NOT NULL,
        Nombre            VARCHAR(150) NOT NULL,
        CodigoCupon       VARCHAR(50) NULL,
        TipoDescuento     VARCHAR(20) NOT NULL,
        ValorDescuento    DECIMAL(18,2) NOT NULL,
        MontoMinimoCompra DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_Promociones_Minimo DEFAULT 0,
        FechaInicio       DATETIME2 NOT NULL,
        FechaFin          DATETIME2 NOT NULL,
        Estado            BIT NOT NULL
            CONSTRAINT DF_Promociones_Estado DEFAULT 1,
        CONSTRAINT PK_Promociones PRIMARY KEY (PromocionId),
        CONSTRAINT CK_Promociones_Tipo
            CHECK (TipoDescuento IN ('PORCENTAJE', 'MONTO_FIJO')),
        CONSTRAINT CK_Promociones_Valor
            CHECK (
                (TipoDescuento = 'PORCENTAJE'
                 AND ValorDescuento BETWEEN 0 AND 100)
                OR
                (TipoDescuento = 'MONTO_FIJO'
                 AND ValorDescuento >= 0)
            ),
        CONSTRAINT CK_Promociones_Minimo
            CHECK (MontoMinimoCompra >= 0),
        CONSTRAINT CK_Promociones_Fechas
            CHECK (FechaFin >= FechaInicio)
    );
END;
GO

IF OBJECT_ID(N'dbo.PromocionProducto', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PromocionProducto
    (
        PromocionId INT NOT NULL,
        ProductoId  INT NOT NULL,
        CONSTRAINT PK_PromocionProducto
            PRIMARY KEY (PromocionId, ProductoId),
        CONSTRAINT FK_PromocionProducto_Promocion
            FOREIGN KEY (PromocionId) REFERENCES dbo.Promociones(PromocionId),
        CONSTRAINT FK_PromocionProducto_Producto
            FOREIGN KEY (ProductoId) REFERENCES dbo.Productos(ProductoId)
    );
END;
GO

IF OBJECT_ID(N'dbo.PromocionCategoria', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PromocionCategoria
    (
        PromocionId INT NOT NULL,
        CategoriaId INT NOT NULL,
        CONSTRAINT PK_PromocionCategoria
            PRIMARY KEY (PromocionId, CategoriaId),
        CONSTRAINT FK_PromocionCategoria_Promocion
            FOREIGN KEY (PromocionId) REFERENCES dbo.Promociones(PromocionId),
        CONSTRAINT FK_PromocionCategoria_Categoria
            FOREIGN KEY (CategoriaId) REFERENCES dbo.Categorias(CategoriaId)
    );
END;
GO

/*
   Parametros contiene las reglas comerciales configurables indicadas por
   el profesor. El valor se guarda según su tipo y no como texto genérico.
*/
IF OBJECT_ID(N'dbo.Parametros', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Parametros
    (
        ParametroId        INT IDENTITY(1,1) NOT NULL,
        Clave              VARCHAR(80) NOT NULL,
        TipoDato           VARCHAR(20) NOT NULL,
        ValorDecimal       DECIMAL(18,4) NULL,
        ValorEntero        INT NULL,
        ValorTexto         VARCHAR(500) NULL,
        ValorBooleano      BIT NULL,
        Descripcion        VARCHAR(255) NULL,
        FechaActualizacion DATETIME2 NOT NULL
            CONSTRAINT DF_Parametros_Fecha DEFAULT SYSDATETIME(),
        Estado             BIT NOT NULL
            CONSTRAINT DF_Parametros_Estado DEFAULT 1,

        CONSTRAINT PK_Parametros PRIMARY KEY (ParametroId),
        CONSTRAINT UQ_Parametros_Clave UNIQUE (Clave),
        CONSTRAINT CK_Parametros_Tipo
            CHECK (TipoDato IN ('DECIMAL','ENTERO','TEXTO','BOOLEAN')),
        CONSTRAINT CK_Parametros_ValorTipo
            CHECK
            (
                (TipoDato = 'DECIMAL'
                 AND ValorDecimal IS NOT NULL
                 AND ValorEntero IS NULL
                 AND ValorTexto IS NULL
                 AND ValorBooleano IS NULL)
                OR
                (TipoDato = 'ENTERO'
                 AND ValorDecimal IS NULL
                 AND ValorEntero IS NOT NULL
                 AND ValorTexto IS NULL
                 AND ValorBooleano IS NULL)
                OR
                (TipoDato = 'TEXTO'
                 AND ValorDecimal IS NULL
                 AND ValorEntero IS NULL
                 AND ValorTexto IS NOT NULL
                 AND ValorBooleano IS NULL)
                OR
                (TipoDato = 'BOOLEAN'
                 AND ValorDecimal IS NULL
                 AND ValorEntero IS NULL
                 AND ValorTexto IS NULL
                 AND ValorBooleano IS NOT NULL)
            )
    );
END;
GO

/* ============================================================================
   5. PEDIDOS, PAGOS Y FACTURACIÓN
   ============================================================================ */

IF OBJECT_ID(N'dbo.Pedidos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Pedidos
    (
        PedidoId    INT IDENTITY(1,1) NOT NULL,
        UsuarioId   INT NOT NULL,
        ClienteId   INT NOT NULL,
        DireccionId INT NOT NULL,
        PromocionId INT NULL,
        FechaPedido DATETIME2 NOT NULL
            CONSTRAINT DF_Pedidos_Fecha DEFAULT SYSDATETIME(),
        Subtotal    DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_Pedidos_Subtotal DEFAULT 0,
        Descuento   DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_Pedidos_Descuento DEFAULT 0,
        IVA         DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_Pedidos_IVA DEFAULT 0,
        Total       DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_Pedidos_Total DEFAULT 0,
        Estado      VARCHAR(30) NOT NULL
            CONSTRAINT DF_Pedidos_Estado DEFAULT 'Pendiente',

        CONSTRAINT PK_Pedidos PRIMARY KEY (PedidoId),
        CONSTRAINT FK_Pedidos_Usuarios
            FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
        CONSTRAINT FK_Pedidos_Clientes
            FOREIGN KEY (ClienteId) REFERENCES dbo.Clientes(ClienteId),
        CONSTRAINT FK_Pedidos_Direcciones
            FOREIGN KEY (DireccionId) REFERENCES dbo.DireccionesCliente(DireccionId),
        CONSTRAINT FK_Pedidos_Promociones
            FOREIGN KEY (PromocionId) REFERENCES dbo.Promociones(PromocionId),
        CONSTRAINT CK_Pedidos_Estado
            CHECK (Estado IN
                ('Pendiente','Procesando','Enviado','Entregado','Cancelado')),
        CONSTRAINT CK_Pedidos_Valores
            CHECK (Subtotal >= 0 AND Descuento >= 0 AND IVA >= 0 AND Total >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.PedidoDetalle', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PedidoDetalle
    (
        PedidoDetalleId INT IDENTITY(1,1) NOT NULL,
        PedidoId        INT NOT NULL,
        ProductoId      INT NOT NULL,
        Cantidad        INT NOT NULL,
        PrecioUnitario  DECIMAL(18,2) NOT NULL,
        Subtotal        DECIMAL(18,2) NOT NULL,
        Descuento       DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_PedidoDetalle_Descuento DEFAULT 0,
        Total           DECIMAL(18,2) NOT NULL,

        CONSTRAINT PK_PedidoDetalle PRIMARY KEY (PedidoDetalleId),
        CONSTRAINT FK_PedidoDetalle_Pedido
            FOREIGN KEY (PedidoId) REFERENCES dbo.Pedidos(PedidoId),
        CONSTRAINT FK_PedidoDetalle_Producto
            FOREIGN KEY (ProductoId) REFERENCES dbo.Productos(ProductoId),
        CONSTRAINT CK_PedidoDetalle_Cantidad CHECK (Cantidad > 0),
        CONSTRAINT CK_PedidoDetalle_Precio CHECK (PrecioUnitario >= 0),
        CONSTRAINT CK_PedidoDetalle_Valores
            CHECK (Subtotal >= 0 AND Descuento >= 0 AND Total >= 0),
        CONSTRAINT CK_PedidoDetalle_Calculo
            CHECK
            (
                Subtotal = CAST(Cantidad * PrecioUnitario AS DECIMAL(18,2))
                AND Total = Subtotal - Descuento
                AND Descuento <= Subtotal
            ),
        CONSTRAINT UQ_PedidoDetalle_Pedido_Producto
            UNIQUE (PedidoId, ProductoId)
    );
END;
GO

IF OBJECT_ID(N'dbo.Pagos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Pagos
    (
        PagoId        INT IDENTITY(1,1) NOT NULL,
        PedidoId      INT NOT NULL,
        MetodoPagoId  INT NOT NULL,
        FechaPago     DATETIME2 NOT NULL
            CONSTRAINT DF_Pagos_Fecha DEFAULT SYSDATETIME(),
        Monto         DECIMAL(18,2) NOT NULL,
        Estado        VARCHAR(30) NOT NULL
            CONSTRAINT DF_Pagos_Estado DEFAULT 'Pendiente',
        TransaccionId VARCHAR(100) NULL,

        CONSTRAINT PK_Pagos PRIMARY KEY (PagoId),
        CONSTRAINT FK_Pagos_Pedidos
            FOREIGN KEY (PedidoId) REFERENCES dbo.Pedidos(PedidoId),
        CONSTRAINT FK_Pagos_Metodos
            FOREIGN KEY (MetodoPagoId) REFERENCES dbo.MetodosPago(MetodoPagoId),
        CONSTRAINT CK_Pagos_Monto CHECK (Monto > 0),
        CONSTRAINT CK_Pagos_Estado
            CHECK (Estado IN ('Pendiente','Pagado','Rechazado','Cancelado'))
    );
END;
GO

IF OBJECT_ID(N'dbo.Favoritos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Favoritos
    (
        FavoritoId INT IDENTITY(1,1) NOT NULL,
        UsuarioId  INT NOT NULL,
        ProductoId INT NOT NULL,
        Fecha      DATETIME2 NOT NULL
            CONSTRAINT DF_Favoritos_Fecha DEFAULT SYSDATETIME(),
        CONSTRAINT PK_Favoritos PRIMARY KEY (FavoritoId),
        CONSTRAINT FK_Favoritos_Usuarios
            FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
        CONSTRAINT FK_Favoritos_Productos
            FOREIGN KEY (ProductoId) REFERENCES dbo.Productos(ProductoId),
        CONSTRAINT UQ_Favoritos_Usuario_Producto
            UNIQUE (UsuarioId, ProductoId)
    );
END;
GO

IF OBJECT_ID(N'dbo.Resenas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Resenas
    (
        ResenaId     INT IDENTITY(1,1) NOT NULL,
        UsuarioId    INT NOT NULL,
        ProductoId   INT NOT NULL,
        Calificacion INT NOT NULL,
        Comentario   VARCHAR(500) NULL,
        Fecha        DATETIME2 NOT NULL
            CONSTRAINT DF_Resenas_Fecha DEFAULT SYSDATETIME(),
        Estado       BIT NOT NULL
            CONSTRAINT DF_Resenas_Estado DEFAULT 1,
        CONSTRAINT PK_Resenas PRIMARY KEY (ResenaId),
        CONSTRAINT FK_Resenas_Usuarios
            FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
        CONSTRAINT FK_Resenas_Productos
            FOREIGN KEY (ProductoId) REFERENCES dbo.Productos(ProductoId),
        CONSTRAINT CK_Resenas_Calificacion
            CHECK (Calificacion BETWEEN 1 AND 5),
        CONSTRAINT UQ_Resenas_Usuario_Producto
            UNIQUE (UsuarioId, ProductoId)
    );
END;
GO

IF OBJECT_ID(N'dbo.Facturas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Facturas
    (
        FacturaId INT IDENTITY(1,1) NOT NULL,
        Numero    VARCHAR(30) NOT NULL,
        PedidoId  INT NULL,
        ClienteId INT NOT NULL,
        UsuarioId INT NOT NULL,
        Fecha     DATETIME2 NOT NULL
            CONSTRAINT DF_Facturas_Fecha DEFAULT SYSDATETIME(),
        Subtotal  DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_Facturas_Subtotal DEFAULT 0,
        Descuento DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_Facturas_Descuento DEFAULT 0,
        Impuesto  DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_Facturas_Impuesto DEFAULT 0,
        Total     DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_Facturas_Total DEFAULT 0,
        Estado    VARCHAR(30) NOT NULL
            CONSTRAINT DF_Facturas_Estado DEFAULT 'Emitida',

        CONSTRAINT PK_Facturas PRIMARY KEY (FacturaId),
        CONSTRAINT FK_Facturas_Pedido
            FOREIGN KEY (PedidoId) REFERENCES dbo.Pedidos(PedidoId),
        CONSTRAINT FK_Facturas_Cliente
            FOREIGN KEY (ClienteId) REFERENCES dbo.Clientes(ClienteId),
        CONSTRAINT FK_Facturas_Usuario
            FOREIGN KEY (UsuarioId) REFERENCES dbo.Usuarios(UsuarioId),
        CONSTRAINT UQ_Facturas_Numero UNIQUE (Numero),
        CONSTRAINT CK_Facturas_Valores
            CHECK (Subtotal >= 0 AND Descuento >= 0
                   AND Impuesto >= 0 AND Total >= 0),
        CONSTRAINT CK_Facturas_Estado
            CHECK (Estado IN ('Emitida','Pagada','Anulada'))
    );
END;
GO

IF OBJECT_ID(N'dbo.DetallesFactura', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DetallesFactura
    (
        DetalleFacturaId    INT IDENTITY(1,1) NOT NULL,
        FacturaId           INT NOT NULL,
        ProductoId          INT NOT NULL,
        Cantidad            INT NOT NULL,
        PrecioUnitario      DECIMAL(18,2) NOT NULL,
        DescuentoPorcentaje DECIMAL(5,2) NOT NULL
            CONSTRAINT DF_DetallesFactura_Porcentaje DEFAULT 0,
        DescuentoValor      DECIMAL(18,2) NOT NULL
            CONSTRAINT DF_DetallesFactura_Valor DEFAULT 0,
        Subtotal            DECIMAL(18,2) NOT NULL,
        Total               DECIMAL(18,2) NOT NULL,

        CONSTRAINT PK_DetallesFactura PRIMARY KEY (DetalleFacturaId),
        CONSTRAINT FK_DetallesFactura_Factura
            FOREIGN KEY (FacturaId) REFERENCES dbo.Facturas(FacturaId),
        CONSTRAINT FK_DetallesFactura_Producto
            FOREIGN KEY (ProductoId) REFERENCES dbo.Productos(ProductoId),
        CONSTRAINT CK_DetallesFactura_Cantidad CHECK (Cantidad > 0),
        CONSTRAINT CK_DetallesFactura_Precio CHECK (PrecioUnitario >= 0),
        CONSTRAINT CK_DetallesFactura_Descuento
            CHECK (DescuentoPorcentaje BETWEEN 0 AND 100
                   AND DescuentoValor >= 0),
        CONSTRAINT CK_DetallesFactura_Valores
            CHECK (Subtotal >= 0 AND Total >= 0),
        CONSTRAINT CK_DetallesFactura_Calculo
            CHECK
            (
                Subtotal = CAST(Cantidad * PrecioUnitario AS DECIMAL(18,2))
                AND Total = Subtotal - DescuentoValor
                AND DescuentoValor <= Subtotal
            ),
        CONSTRAINT UQ_DetallesFactura_Factura_Producto
            UNIQUE (FacturaId, ProductoId)
    );
END;
GO

/* ============================================================================
   6. AUDITORÍA
   ============================================================================ */

IF OBJECT_ID(N'dbo.AuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditLog
    (
        AuditLogId      BIGINT IDENTITY(1,1) NOT NULL,
        Tabla           VARCHAR(100) NOT NULL,
        RegistroId      INT NOT NULL,
        Accion          VARCHAR(10) NOT NULL,
        DatosAnteriores NVARCHAR(MAX) NULL,
        DatosNuevos     NVARCHAR(MAX) NULL,
        Usuario         VARCHAR(100) NOT NULL
            CONSTRAINT DF_AuditLog_Usuario DEFAULT SUSER_SNAME(),
        FechaHora       DATETIME2 NOT NULL
            CONSTRAINT DF_AuditLog_Fecha DEFAULT SYSDATETIME(),

        CONSTRAINT PK_AuditLog PRIMARY KEY (AuditLogId),
        CONSTRAINT CK_AuditLog_Accion
            CHECK (Accion IN ('INSERT','UPDATE','DELETE'))
    );
END;
GO

/* ============================================================================
   7. ÍNDICES
   ============================================================================ */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Personas_Email')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Personas_Email
        ON dbo.Personas(Email)
        WHERE Email IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Direcciones_Principal')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Direcciones_Principal
        ON dbo.DireccionesCliente(ClienteId)
        WHERE EsPrincipal = 1 AND Estado = 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Imagenes_Principal')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Imagenes_Principal
        ON dbo.ImagenesProducto(ProductoId)
        WHERE EsPrincipal = 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Promociones_Cupon')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Promociones_Cupon
        ON dbo.Promociones(CodigoCupon)
        WHERE CodigoCupon IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Facturas_Pedido_Activo')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Facturas_Pedido_Activo
        ON dbo.Facturas(PedidoId)
        WHERE PedidoId IS NOT NULL AND Estado <> 'Anulada';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_Categoria')
    CREATE INDEX IX_Productos_Categoria ON dbo.Productos(CategoriaId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_Marca')
    CREATE INDEX IX_Productos_Marca ON dbo.Productos(MarcaId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Productos_Stock')
    CREATE INDEX IX_Productos_Stock ON dbo.Productos(Stock);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ProductoProveedor_Proveedor')
    CREATE INDEX IX_ProductoProveedor_Proveedor
        ON dbo.ProductoProveedor(ProveedorId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Movimientos_Producto')
    CREATE INDEX IX_Movimientos_Producto
        ON dbo.MovimientosInventario(ProductoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Movimientos_Fecha')
    CREATE INDEX IX_Movimientos_Fecha
        ON dbo.MovimientosInventario(Fecha);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Movimientos_Usuario')
    CREATE INDEX IX_Movimientos_Usuario
        ON dbo.MovimientosInventario(UsuarioId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_Cliente')
    CREATE INDEX IX_Pedidos_Cliente ON dbo.Pedidos(ClienteId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_Usuario')
    CREATE INDEX IX_Pedidos_Usuario ON dbo.Pedidos(UsuarioId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_Fecha')
    CREATE INDEX IX_Pedidos_Fecha ON dbo.Pedidos(FechaPedido);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pedidos_Direccion')
    CREATE INDEX IX_Pedidos_Direccion ON dbo.Pedidos(DireccionId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PedidoDetalle_Producto')
    CREATE INDEX IX_PedidoDetalle_Producto ON dbo.PedidoDetalle(ProductoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pagos_Pedido')
    CREATE INDEX IX_Pagos_Pedido ON dbo.Pagos(PedidoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Facturas_Cliente')
    CREATE INDEX IX_Facturas_Cliente ON dbo.Facturas(ClienteId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Facturas_Fecha')
    CREATE INDEX IX_Facturas_Fecha ON dbo.Facturas(Fecha);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Facturas_Pedido')
    CREATE INDEX IX_Facturas_Pedido ON dbo.Facturas(PedidoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_DetallesFactura_Producto')
    CREATE INDEX IX_DetallesFactura_Producto
        ON dbo.DetallesFactura(ProductoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Promociones_Fechas')
    CREATE INDEX IX_Promociones_Fechas
        ON dbo.Promociones(FechaInicio, FechaFin);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLog_Tabla_Fecha')
    CREATE INDEX IX_AuditLog_Tabla_Fecha
        ON dbo.AuditLog(Tabla, FechaHora);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Imagenes_Producto')
    CREATE INDEX IX_Imagenes_Producto
        ON dbo.ImagenesProducto(ProductoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Direcciones_Cliente')
    CREATE INDEX IX_Direcciones_Cliente
        ON dbo.DireccionesCliente(ClienteId);
GO

/* ============================================================================
   8. TRIGGERS DE INTEGRIDAD
   ============================================================================ */

CREATE OR ALTER TRIGGER dbo.TR_MovimientosInventario_ActualizarStock
ON dbo.MovimientosInventario
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted I
        INNER JOIN dbo.TiposMovimientoInventario T
            ON T.TipoMovimientoId = I.TipoMovimientoId
        WHERE T.Nombre IN ('Entrada','Salida')
          AND I.Cantidad <= 0
    )
    BEGIN
        RAISERROR(
            'Las entradas y salidas deben registrar cantidades mayores que cero.',
            16, 1
        );
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.Productos P
        INNER JOIN
        (
            SELECT
                I.ProductoId,
                SUM
                (
                    CASE
                        WHEN T.Nombre = 'Entrada' THEN I.Cantidad
                        WHEN T.Nombre = 'Salida'  THEN -I.Cantidad
                        WHEN T.Nombre = 'Ajuste'  THEN I.Cantidad
                        ELSE 0
                    END
                ) AS CambioStock
            FROM inserted I
            INNER JOIN dbo.TiposMovimientoInventario T
                ON T.TipoMovimientoId = I.TipoMovimientoId
            GROUP BY I.ProductoId
        ) M ON M.ProductoId = P.ProductoId
        WHERE P.Stock + M.CambioStock < 0
    )
    BEGIN
        RAISERROR(
            'No existe suficiente stock para realizar el movimiento.',
            16, 1
        );
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    UPDATE P
       SET P.Stock = P.Stock + M.CambioStock
    FROM dbo.Productos P
    INNER JOIN
    (
        SELECT
            I.ProductoId,
            SUM
            (
                CASE
                    WHEN T.Nombre = 'Entrada' THEN I.Cantidad
                    WHEN T.Nombre = 'Salida'  THEN -I.Cantidad
                    WHEN T.Nombre = 'Ajuste'  THEN I.Cantidad
                    ELSE 0
                END
            ) AS CambioStock
        FROM inserted I
        INNER JOIN dbo.TiposMovimientoInventario T
            ON T.TipoMovimientoId = I.TipoMovimientoId
        GROUP BY I.ProductoId
    ) M ON M.ProductoId = P.ProductoId;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Pedidos_ValidarDireccion
ON dbo.Pedidos
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted I
        INNER JOIN dbo.DireccionesCliente D
            ON D.DireccionId = I.DireccionId
        WHERE D.ClienteId <> I.ClienteId
    )
    BEGIN
        RAISERROR(
            'La dirección no pertenece al cliente del pedido.',
            16, 1
        );
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Pedidos_ValidarUsuarioCliente
ON dbo.Pedidos
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS
    (
        SELECT 1
        FROM inserted I
        INNER JOIN dbo.Usuarios U
            ON U.UsuarioId = I.UsuarioId
        INNER JOIN dbo.Clientes C
            ON C.ClienteId = I.ClienteId
        INNER JOIN dbo.Roles R
            ON R.RolId = U.RolId
        WHERE R.Nombre = 'Cliente'
          AND U.PersonaId <> C.PersonaId
    )
    BEGIN
        RAISERROR(
            'Un usuario Cliente solamente puede registrar pedidos para si mismo.',
            16, 1
        );
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
GO

/* ============================================================================
   9. AUDITORÍA
   ============================================================================ */

CREATE OR ALTER TRIGGER dbo.TR_Productos_Auditoria
ON dbo.Productos
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.AuditLog
    (
        Tabla, RegistroId, Accion,
        DatosAnteriores, DatosNuevos, Usuario
    )
    SELECT
        'Productos',
        S.ProductoId,
        CASE
            WHEN I.ProductoId IS NOT NULL AND D.ProductoId IS NOT NULL
                THEN 'UPDATE'
            WHEN I.ProductoId IS NOT NULL
                THEN 'INSERT'
            ELSE 'DELETE'
        END,
        CASE
            WHEN D.ProductoId IS NOT NULL
                THEN (SELECT * FROM deleted X
                      WHERE X.ProductoId = S.ProductoId
                      FOR JSON PATH)
        END,
        CASE
            WHEN I.ProductoId IS NOT NULL
                THEN (SELECT * FROM inserted X
                      WHERE X.ProductoId = S.ProductoId
                      FOR JSON PATH)
        END,
        SUSER_SNAME()
    FROM
    (
        SELECT ProductoId FROM inserted
        UNION
        SELECT ProductoId FROM deleted
    ) S
    LEFT JOIN inserted I ON I.ProductoId = S.ProductoId
    LEFT JOIN deleted D ON D.ProductoId = S.ProductoId;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Pedidos_Auditoria
ON dbo.Pedidos
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.AuditLog
    (
        Tabla, RegistroId, Accion,
        DatosAnteriores, DatosNuevos, Usuario
    )
    SELECT
        'Pedidos',
        S.PedidoId,
        CASE
            WHEN I.PedidoId IS NOT NULL AND D.PedidoId IS NOT NULL
                THEN 'UPDATE'
            WHEN I.PedidoId IS NOT NULL
                THEN 'INSERT'
            ELSE 'DELETE'
        END,
        CASE
            WHEN D.PedidoId IS NOT NULL
                THEN (SELECT * FROM deleted X
                      WHERE X.PedidoId = S.PedidoId
                      FOR JSON PATH)
        END,
        CASE
            WHEN I.PedidoId IS NOT NULL
                THEN (SELECT * FROM inserted X
                      WHERE X.PedidoId = S.PedidoId
                      FOR JSON PATH)
        END,
        SUSER_SNAME()
    FROM
    (
        SELECT PedidoId FROM inserted
        UNION
        SELECT PedidoId FROM deleted
    ) S
    LEFT JOIN inserted I ON I.PedidoId = S.PedidoId
    LEFT JOIN deleted D ON D.PedidoId = S.PedidoId;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Facturas_Auditoria
ON dbo.Facturas
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dbo.AuditLog
    (
        Tabla, RegistroId, Accion,
        DatosAnteriores, DatosNuevos, Usuario
    )
    SELECT
        'Facturas',
        S.FacturaId,
        CASE
            WHEN I.FacturaId IS NOT NULL AND D.FacturaId IS NOT NULL
                THEN 'UPDATE'
            WHEN I.FacturaId IS NOT NULL
                THEN 'INSERT'
            ELSE 'DELETE'
        END,
        CASE
            WHEN D.FacturaId IS NOT NULL
                THEN (SELECT * FROM deleted X
                      WHERE X.FacturaId = S.FacturaId
                      FOR JSON PATH)
        END,
        CASE
            WHEN I.FacturaId IS NOT NULL
                THEN (SELECT * FROM inserted X
                      WHERE X.FacturaId = S.FacturaId
                      FOR JSON PATH)
        END,
        SUSER_SNAME()
    FROM
    (
        SELECT FacturaId FROM inserted
        UNION
        SELECT FacturaId FROM deleted
    ) S
    LEFT JOIN inserted I ON I.FacturaId = S.FacturaId
    LEFT JOIN deleted D ON D.FacturaId = S.FacturaId;
END;
GO

/* ============================================================================
   10. FUNCIÓN PARA PARÁMETROS
   ============================================================================ */

CREATE OR ALTER FUNCTION dbo.fn_ObtenerParametroDecimal
(
    @Clave VARCHAR(80)
)
RETURNS DECIMAL(18,4)
AS
BEGIN
    DECLARE @Valor DECIMAL(18,4);

    SELECT @Valor = ValorDecimal
    FROM dbo.Parametros
    WHERE Clave = @Clave
      AND TipoDato = 'DECIMAL'
      AND Estado = 1;

    RETURN @Valor;
END;
GO

/* ============================================================================
   11. PROCEDIMIENTOS DE INVENTARIO
   ============================================================================ */

CREATE OR ALTER PROCEDURE dbo.sp_RegistrarEntradaInventario
    @ProductoId  INT,
    @ProveedorId INT = NULL,
    @UsuarioId   INT,
    @Cantidad    INT,
    @Motivo      VARCHAR(255) = NULL,
    @Observacion VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Cantidad <= 0
        THROW 50001, 'La cantidad debe ser mayor que cero.', 1;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Productos
        WHERE ProductoId = @ProductoId AND Estado = 1
    )
        THROW 50002, 'El producto no existe o esta inactivo.', 1;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Usuarios
        WHERE UsuarioId = @UsuarioId AND Estado = 1
    )
        THROW 50003, 'El usuario no existe o esta inactivo.', 1;

    IF @ProveedorId IS NOT NULL
       AND NOT EXISTS
       (
           SELECT 1 FROM dbo.Proveedores
           WHERE ProveedorId = @ProveedorId AND Estado = 1
       )
        THROW 50004, 'El proveedor no existe o esta inactivo.', 1;

    INSERT INTO dbo.MovimientosInventario
    (
        ProductoId, ProveedorId, UsuarioId,
        TipoMovimientoId, Cantidad, Motivo, Observacion
    )
    SELECT
        @ProductoId, @ProveedorId, @UsuarioId,
        TipoMovimientoId, @Cantidad, @Motivo, @Observacion
    FROM dbo.TiposMovimientoInventario
    WHERE Nombre = 'Entrada';

    SELECT ProductoId, Nombre, Stock
    FROM dbo.Productos
    WHERE ProductoId = @ProductoId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RegistrarSalidaInventario
    @ProductoId  INT,
    @UsuarioId   INT,
    @Cantidad    INT,
    @Motivo      VARCHAR(255) = NULL,
    @Observacion VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Cantidad <= 0
        THROW 50005, 'La cantidad debe ser mayor que cero.', 1;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Productos
        WHERE ProductoId = @ProductoId AND Estado = 1
    )
        THROW 50006, 'El producto no existe o esta inactivo.', 1;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Usuarios
        WHERE UsuarioId = @UsuarioId AND Estado = 1
    )
        THROW 50007, 'El usuario no existe o esta inactivo.', 1;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Productos
        WHERE ProductoId = @ProductoId AND Stock >= @Cantidad
    )
        THROW 50008, 'No existe suficiente stock.', 1;

    INSERT INTO dbo.MovimientosInventario
    (
        ProductoId, UsuarioId, TipoMovimientoId,
        Cantidad, Motivo, Observacion
    )
    SELECT
        @ProductoId, @UsuarioId, TipoMovimientoId,
        @Cantidad, @Motivo, @Observacion
    FROM dbo.TiposMovimientoInventario
    WHERE Nombre = 'Salida';

    SELECT ProductoId, Nombre, Stock
    FROM dbo.Productos
    WHERE ProductoId = @ProductoId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RegistrarAjusteInventario
    @ProductoId  INT,
    @UsuarioId   INT,
    @Cantidad    INT,
    @Motivo      VARCHAR(255) = NULL,
    @Observacion VARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Cantidad = 0
        THROW 50009, 'La cantidad del ajuste no puede ser cero.', 1;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Productos
        WHERE ProductoId = @ProductoId AND Estado = 1
    )
        THROW 50010, 'El producto no existe o esta inactivo.', 1;

    IF NOT EXISTS
    (
        SELECT 1 FROM dbo.Usuarios
        WHERE UsuarioId = @UsuarioId AND Estado = 1
    )
        THROW 50011, 'El usuario no existe o esta inactivo.', 1;

    INSERT INTO dbo.MovimientosInventario
    (
        ProductoId, UsuarioId, TipoMovimientoId,
        Cantidad, Motivo, Observacion
    )
    SELECT
        @ProductoId, @UsuarioId, TipoMovimientoId,
        @Cantidad, @Motivo, @Observacion
    FROM dbo.TiposMovimientoInventario
    WHERE Nombre = 'Ajuste';

    SELECT ProductoId, Nombre, Stock
    FROM dbo.Productos
    WHERE ProductoId = @ProductoId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ConsultarStockProducto
    @ProductoId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        P.ProductoId,
        P.SKU,
        P.Nombre AS Producto,
        P.Stock,
        P.StockMinimo,
        CASE
            WHEN P.Stock = 0 THEN 'SIN STOCK'
            WHEN P.Stock <= P.StockMinimo THEN 'STOCK BAJO'
            ELSE 'STOCK NORMAL'
        END AS EstadoStock
    FROM dbo.Productos P
    WHERE P.ProductoId = @ProductoId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ProductosStockBajo
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        P.ProductoId,
        P.SKU,
        P.Nombre AS Producto,
        P.Stock,
        P.StockMinimo,
        C.Nombre AS Categoria,
        M.Nombre AS Marca
    FROM dbo.Productos P
    INNER JOIN dbo.Categorias C ON C.CategoriaId = P.CategoriaId
    INNER JOIN dbo.Marcas M ON M.MarcaId = P.MarcaId
    WHERE P.Stock <= P.StockMinimo
      AND P.Estado = 1
    ORDER BY P.Stock ASC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ConsultarMovimientosInventario
    @ProductoId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        MI.MovimientoId,
        P.Nombre AS Producto,
        P.SKU,
        T.Nombre AS TipoMovimiento,
        MI.Cantidad,
        PE.Nombres + ' ' + PE.Apellidos AS Usuario,
        PR.NombreEmpresa AS Proveedor,
        MI.Motivo,
        MI.Observacion,
        MI.Fecha
    FROM dbo.MovimientosInventario MI
    INNER JOIN dbo.Productos P ON P.ProductoId = MI.ProductoId
    INNER JOIN dbo.TiposMovimientoInventario T
        ON T.TipoMovimientoId = MI.TipoMovimientoId
    INNER JOIN dbo.Usuarios U ON U.UsuarioId = MI.UsuarioId
    INNER JOIN dbo.Personas PE ON PE.PersonaId = U.PersonaId
    LEFT JOIN dbo.Proveedores PR ON PR.ProveedorId = MI.ProveedorId
    WHERE @ProductoId IS NULL OR MI.ProductoId = @ProductoId
    ORDER BY MI.Fecha DESC;
END;
GO

/* ============================================================================
   12. PROCEDIMIENTOS DE FACTURACIÓN
   ============================================================================ */

CREATE OR ALTER PROCEDURE dbo.sp_ConsultarFacturasPorFecha
    @FechaInicio DATE,
    @FechaFin DATE
AS
BEGIN
    SET NOCOUNT ON;

    IF @FechaFin < @FechaInicio
        THROW 50012, 'La fecha final no puede ser menor que la fecha inicial.', 1;

    SELECT
        F.FacturaId,
        F.Numero,
        C.Identificacion,
        PE.Nombres + ' ' + PE.Apellidos AS Cliente,
        F.Fecha,
        F.Subtotal,
        F.Descuento,
        F.Impuesto,
        F.Total,
        F.Estado
    FROM dbo.Facturas F
    INNER JOIN dbo.Clientes C ON C.ClienteId = F.ClienteId
    INNER JOIN dbo.Personas PE ON PE.PersonaId = C.PersonaId
    WHERE F.Fecha >= @FechaInicio
      AND F.Fecha < DATEADD(DAY, 1, @FechaFin)
    ORDER BY F.Fecha DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ConsultarFactura
    @FacturaId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        F.FacturaId,
        F.Numero,
        F.Fecha,
        C.Identificacion,
        PE.Nombres + ' ' + PE.Apellidos AS Cliente,
        PE.Email,
        PE.Telefono,
        P.Nombre AS Producto,
        DF.Cantidad,
        DF.PrecioUnitario,
        DF.DescuentoPorcentaje,
        DF.DescuentoValor,
        DF.Subtotal,
        DF.Total,
        F.Descuento AS DescuentoFactura,
        F.Impuesto,
        F.Total AS TotalFactura,
        F.Estado
    FROM dbo.Facturas F
    INNER JOIN dbo.Clientes C ON C.ClienteId = F.ClienteId
    INNER JOIN dbo.Personas PE ON PE.PersonaId = C.PersonaId
    INNER JOIN dbo.DetallesFactura DF ON DF.FacturaId = F.FacturaId
    INNER JOIN dbo.Productos P ON P.ProductoId = DF.ProductoId
    WHERE F.FacturaId = @FacturaId;
END;
GO

/* ============================================================================
   13. VISTAS
   ============================================================================ */

CREATE OR ALTER VIEW dbo.vw_InventarioActual
AS
SELECT
    P.ProductoId,
    P.SKU,
    P.Nombre AS Producto,
    C.Nombre AS Categoria,
    M.Nombre AS Marca,
    P.Precio,
    P.Stock,
    P.StockMinimo,
    CASE
        WHEN P.Stock = 0 THEN 'SIN STOCK'
        WHEN P.Stock <= P.StockMinimo THEN 'STOCK BAJO'
        ELSE 'STOCK NORMAL'
    END AS EstadoStock,
    P.Estado
FROM dbo.Productos P
INNER JOIN dbo.Categorias C ON C.CategoriaId = P.CategoriaId
INNER JOIN dbo.Marcas M ON M.MarcaId = P.MarcaId;
GO

CREATE OR ALTER VIEW dbo.vw_Ventas
AS
SELECT
    F.FacturaId,
    F.Numero,
    F.Fecha,
    C.Identificacion,
    PE.Nombres + ' ' + PE.Apellidos AS Cliente,
    F.Subtotal,
    F.Descuento,
    F.Impuesto,
    F.Total,
    F.Estado
FROM dbo.Facturas F
INNER JOIN dbo.Clientes C ON C.ClienteId = F.ClienteId
INNER JOIN dbo.Personas PE ON PE.PersonaId = C.PersonaId;
GO

CREATE OR ALTER VIEW dbo.vw_ProductosCatalogo
AS
SELECT
    P.ProductoId,
    P.SKU,
    P.Nombre,
    P.Descripcion,
    P.Precio,
    P.Stock,
    P.StockMinimo,
    C.Nombre AS Categoria,
    M.Nombre AS Marca,
    I.UrlImagen,
    P.Estado
FROM dbo.Productos P
INNER JOIN dbo.Categorias C ON C.CategoriaId = P.CategoriaId
INNER JOIN dbo.Marcas M ON M.MarcaId = P.MarcaId
LEFT JOIN dbo.ImagenesProducto I
    ON I.ProductoId = P.ProductoId
   AND I.EsPrincipal = 1;
GO

CREATE OR ALTER VIEW dbo.vw_VerificacionStock
AS
SELECT
    P.ProductoId,
    P.SKU,
    P.Nombre AS Producto,
    P.Stock AS StockRegistrado,
    ISNULL
    (
        SUM
        (
            CASE
                WHEN T.Nombre = 'Entrada' THEN MI.Cantidad
                WHEN T.Nombre = 'Salida' THEN -MI.Cantidad
                WHEN T.Nombre = 'Ajuste' THEN MI.Cantidad
                ELSE 0
            END
        ), 0
    ) AS StockCalculado,
    P.Stock -
    ISNULL
    (
        SUM
        (
            CASE
                WHEN T.Nombre = 'Entrada' THEN MI.Cantidad
                WHEN T.Nombre = 'Salida' THEN -MI.Cantidad
                WHEN T.Nombre = 'Ajuste' THEN MI.Cantidad
                ELSE 0
            END
        ), 0
    ) AS Diferencia
FROM dbo.Productos P
LEFT JOIN dbo.MovimientosInventario MI
    ON MI.ProductoId = P.ProductoId
LEFT JOIN dbo.TiposMovimientoInventario T
    ON T.TipoMovimientoId = MI.TipoMovimientoId
GROUP BY P.ProductoId, P.SKU, P.Nombre, P.Stock;
GO

/* ============================================================================
   14. DATOS INICIALES
   ============================================================================ */

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Nombre = 'Administrador')
    INSERT INTO dbo.Roles (Nombre, Descripcion)
    VALUES ('Administrador',
            'Gestiona usuarios, clientes, productos, inventario, promociones y facturacion');

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Nombre = 'Cliente')
    INSERT INTO dbo.Roles (Nombre, Descripcion)
    VALUES ('Cliente',
            'Consulta productos, administra su cuenta y realiza compras');
GO

IF NOT EXISTS
(
    SELECT 1 FROM dbo.Personas WHERE Email = 'admin@tecnomega.com'
)
BEGIN
    INSERT INTO dbo.Personas
    (Nombres, Apellidos, Email, Telefono)
    VALUES
    ('Administrador', 'Sistema', 'admin@tecnomega.com', '0999999000');
END;
GO

/*
    Hash de desarrollo PBKDF2-SHA256.
    Usuario: admin@tecnomega.com
    Contraseña inicial: Admin123!
    FastAPI debe cambiar esta contraseña después de la primera configuración.
*/
IF NOT EXISTS
(
    SELECT 1
    FROM dbo.Usuarios U
    INNER JOIN dbo.Personas P ON P.PersonaId = U.PersonaId
    WHERE P.Email = 'admin@tecnomega.com'
)
BEGIN
    INSERT INTO dbo.Usuarios
    (PersonaId, RolId, PasswordHash)
    VALUES
    (
        (SELECT PersonaId FROM dbo.Personas
         WHERE Email = 'admin@tecnomega.com'),
        (SELECT RolId FROM dbo.Roles
         WHERE Nombre = 'Administrador'),
        'pbkdf2_sha256$600000$I1nuLKJHU1D0hL2BvbvYiA==$japKvzhi6QB48zV5cz6K2yHKMalHuPDbrcRCdc8W/U8='
    );
END;
GO

/* CATEGORÍAS */
IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = 'Audio')
    INSERT INTO dbo.Categorias (Nombre, Descripcion)
    VALUES ('Audio', 'Audifonos y dispositivos de audio');

IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = 'Perifericos')
    INSERT INTO dbo.Categorias (Nombre, Descripcion)
    VALUES ('Perifericos', 'Mouse, teclados y accesorios');

IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = 'Smartphones')
    INSERT INTO dbo.Categorias (Nombre, Descripcion)
    VALUES ('Smartphones', 'Telefonos inteligentes');

IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = 'Laptops')
    INSERT INTO dbo.Categorias (Nombre, Descripcion)
    VALUES ('Laptops', 'Computadoras portatiles');

IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = 'Gaming')
    INSERT INTO dbo.Categorias (Nombre, Descripcion)
    VALUES ('Gaming', 'Equipos y productos para videojuegos');

IF NOT EXISTS (SELECT 1 FROM dbo.Categorias WHERE Nombre = 'Componentes')
    INSERT INTO dbo.Categorias (Nombre, Descripcion)
    VALUES ('Componentes', 'Componentes para computadoras');
GO

/* MARCAS */
IF NOT EXISTS (SELECT 1 FROM dbo.Marcas WHERE Nombre = 'Apple')
    INSERT INTO dbo.Marcas (Nombre, Descripcion)
    VALUES ('Apple', 'Tecnologia y dispositivos electronicos');

IF NOT EXISTS (SELECT 1 FROM dbo.Marcas WHERE Nombre = 'Logitech')
    INSERT INTO dbo.Marcas (Nombre, Descripcion)
    VALUES ('Logitech', 'Perifericos de oficina y gaming');

IF NOT EXISTS (SELECT 1 FROM dbo.Marcas WHERE Nombre = 'ASUS')
    INSERT INTO dbo.Marcas (Nombre, Descripcion)
    VALUES ('ASUS', 'Computacion y hardware gaming');

IF NOT EXISTS (SELECT 1 FROM dbo.Marcas WHERE Nombre = 'NVIDIA')
    INSERT INTO dbo.Marcas (Nombre, Descripcion)
    VALUES ('NVIDIA', 'Procesamiento grafico');

IF NOT EXISTS (SELECT 1 FROM dbo.Marcas WHERE Nombre = 'Samsung')
    INSERT INTO dbo.Marcas (Nombre, Descripcion)
    VALUES ('Samsung', 'Tecnologia y smartphones');
GO

/* PROVEEDORES */
IF NOT EXISTS (SELECT 1 FROM dbo.Proveedores WHERE NombreEmpresa = 'Apple Ecuador')
    INSERT INTO dbo.Proveedores
    (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES
    ('Apple Ecuador', '1791234560001', 'Ventas',
     '0999999001', 'ventas@apple.com', 'Quito, Ecuador');

IF NOT EXISTS (SELECT 1 FROM dbo.Proveedores WHERE NombreEmpresa = 'Logitech Ecuador')
    INSERT INTO dbo.Proveedores
    (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES
    ('Logitech Ecuador', '1792345670001', 'Ventas',
     '0999999002', 'ventas@logitech.com', 'Quito, Ecuador');

IF NOT EXISTS (SELECT 1 FROM dbo.Proveedores WHERE NombreEmpresa = 'ASUS Ecuador')
    INSERT INTO dbo.Proveedores
    (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES
    ('ASUS Ecuador', '1793456780001', 'Ventas',
     '0999999003', 'ventas@asus.com', 'Quito, Ecuador');

IF NOT EXISTS (SELECT 1 FROM dbo.Proveedores WHERE NombreEmpresa = 'NVIDIA Distribuidor')
    INSERT INTO dbo.Proveedores
    (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES
    ('NVIDIA Distribuidor', '1794567890001', 'Ventas',
     '0999999004', 'ventas@nvidia.com', 'Quito, Ecuador');

IF NOT EXISTS (SELECT 1 FROM dbo.Proveedores WHERE NombreEmpresa = 'Samsung Ecuador')
    INSERT INTO dbo.Proveedores
    (NombreEmpresa, RUC, Contacto, Telefono, Email, Direccion)
    VALUES
    ('Samsung Ecuador', '1795678900001', 'Ventas',
     '0999999005', 'ventas@samsung.com', 'Quito, Ecuador');
GO

/* TIPOS DE MOVIMIENTO */
IF NOT EXISTS
(
    SELECT 1 FROM dbo.TiposMovimientoInventario WHERE Nombre = 'Entrada'
)
    INSERT INTO dbo.TiposMovimientoInventario
    (Nombre, Descripcion)
    VALUES ('Entrada', 'Ingreso de productos al inventario');

IF NOT EXISTS
(
    SELECT 1 FROM dbo.TiposMovimientoInventario WHERE Nombre = 'Salida'
)
    INSERT INTO dbo.TiposMovimientoInventario
    (Nombre, Descripcion)
    VALUES ('Salida', 'Salida de productos del inventario');

IF NOT EXISTS
(
    SELECT 1 FROM dbo.TiposMovimientoInventario WHERE Nombre = 'Ajuste'
)
    INSERT INTO dbo.TiposMovimientoInventario
    (Nombre, Descripcion)
    VALUES ('Ajuste', 'Ajuste positivo o negativo del inventario');
GO

/* MÉTODOS DE PAGO */
IF NOT EXISTS (SELECT 1 FROM dbo.MetodosPago WHERE Nombre = 'Efectivo')
    INSERT INTO dbo.MetodosPago (Nombre) VALUES ('Efectivo');

IF NOT EXISTS (SELECT 1 FROM dbo.MetodosPago WHERE Nombre = 'Transferencia')
    INSERT INTO dbo.MetodosPago (Nombre) VALUES ('Transferencia');

IF NOT EXISTS (SELECT 1 FROM dbo.MetodosPago WHERE Nombre = 'Tarjeta')
    INSERT INTO dbo.MetodosPago (Nombre) VALUES ('Tarjeta');
GO

/* PARÁMETROS COMERCIALES */
IF NOT EXISTS (SELECT 1 FROM dbo.Parametros WHERE Clave = 'IVA_PORCENTAJE')
BEGIN
    INSERT INTO dbo.Parametros
    (Clave, TipoDato, ValorDecimal, Descripcion)
    VALUES
    ('IVA_PORCENTAJE', 'DECIMAL', 15.0000,
     'Porcentaje de IVA utilizado en las ventas');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Parametros WHERE Clave = 'COSTO_ENVIO_BASE')
BEGIN
    INSERT INTO dbo.Parametros
    (Clave, TipoDato, ValorDecimal, Descripcion)
    VALUES
    ('COSTO_ENVIO_BASE', 'DECIMAL', 5.0000,
     'Costo base de envio');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Parametros WHERE Clave = 'MONTO_ENVIO_GRATIS')
BEGIN
    INSERT INTO dbo.Parametros
    (Clave, TipoDato, ValorDecimal, Descripcion)
    VALUES
    ('MONTO_ENVIO_GRATIS', 'DECIMAL', 100.0000,
     'Monto minimo de compra para envio gratuito');
END;
GO

/* PRODUCTOS */
IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE SKU = 'TM-AIRPODS-001')
    INSERT INTO dbo.Productos
    (CategoriaId, MarcaId, SKU, Nombre, Descripcion, Precio, Stock, StockMinimo)
    VALUES
    ((SELECT CategoriaId FROM dbo.Categorias WHERE Nombre = 'Audio'),
     (SELECT MarcaId FROM dbo.Marcas WHERE Nombre = 'Apple'),
     'TM-AIRPODS-001', 'AirPods',
     'Audifonos inalambricos Apple', 249.99, 0, 5);

IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE SKU = 'TM-GPRO-001')
    INSERT INTO dbo.Productos
    (CategoriaId, MarcaId, SKU, Nombre, Descripcion, Precio, Stock, StockMinimo)
    VALUES
    ((SELECT CategoriaId FROM dbo.Categorias WHERE Nombre = 'Perifericos'),
     (SELECT MarcaId FROM dbo.Marcas WHERE Nombre = 'Logitech'),
     'TM-GPRO-001', 'Logitech G Pro',
     'Mouse gaming Logitech G Pro', 129.99, 0, 5);

IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE SKU = 'TM-IPHONE-001')
    INSERT INTO dbo.Productos
    (CategoriaId, MarcaId, SKU, Nombre, Descripcion, Precio, Stock, StockMinimo)
    VALUES
    ((SELECT CategoriaId FROM dbo.Categorias WHERE Nombre = 'Smartphones'),
     (SELECT MarcaId FROM dbo.Marcas WHERE Nombre = 'Apple'),
     'TM-IPHONE-001', 'iPhone',
     'Smartphone Apple iPhone', 799.99, 0, 3);

IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE SKU = 'TM-MACBOOK-001')
    INSERT INTO dbo.Productos
    (CategoriaId, MarcaId, SKU, Nombre, Descripcion, Precio, Stock, StockMinimo)
    VALUES
    ((SELECT CategoriaId FROM dbo.Categorias WHERE Nombre = 'Laptops'),
     (SELECT MarcaId FROM dbo.Marcas WHERE Nombre = 'Apple'),
     'TM-MACBOOK-001', 'MacBook',
     'Computadora portatil Apple MacBook', 999.99, 0, 2);

IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE SKU = 'TM-MXMASTER-001')
    INSERT INTO dbo.Productos
    (CategoriaId, MarcaId, SKU, Nombre, Descripcion, Precio, Stock, StockMinimo)
    VALUES
    ((SELECT CategoriaId FROM dbo.Categorias WHERE Nombre = 'Perifericos'),
     (SELECT MarcaId FROM dbo.Marcas WHERE Nombre = 'Logitech'),
     'TM-MXMASTER-001', 'Logitech MX Master',
     'Mouse inalambrico Logitech MX Master', 99.99, 0, 5);

IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE SKU = 'TM-ROG-001')
    INSERT INTO dbo.Productos
    (CategoriaId, MarcaId, SKU, Nombre, Descripcion, Precio, Stock, StockMinimo)
    VALUES
    ((SELECT CategoriaId FROM dbo.Categorias WHERE Nombre = 'Gaming'),
     (SELECT MarcaId FROM dbo.Marcas WHERE Nombre = 'ASUS'),
     'TM-ROG-001', 'ASUS ROG',
     'Laptop gaming ASUS ROG', 1499.99, 0, 2);

IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE SKU = 'TM-RTX4090-001')
    INSERT INTO dbo.Productos
    (CategoriaId, MarcaId, SKU, Nombre, Descripcion, Precio, Stock, StockMinimo)
    VALUES
    ((SELECT CategoriaId FROM dbo.Categorias WHERE Nombre = 'Componentes'),
     (SELECT MarcaId FROM dbo.Marcas WHERE Nombre = 'NVIDIA'),
     'TM-RTX4090-001', 'RTX 4090',
     'Tarjeta grafica NVIDIA GeForce RTX 4090', 1899.99, 0, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Productos WHERE SKU = 'TM-S24-001')
    INSERT INTO dbo.Productos
    (CategoriaId, MarcaId, SKU, Nombre, Descripcion, Precio, Stock, StockMinimo)
    VALUES
    ((SELECT CategoriaId FROM dbo.Categorias WHERE Nombre = 'Smartphones'),
     (SELECT MarcaId FROM dbo.Marcas WHERE Nombre = 'Samsung'),
     'TM-S24-001', 'Samsung Galaxy S24',
     'Smartphone Samsung Galaxy S24', 799.99, 0, 3);
GO

/* RELACIONES PRODUCTO - PROVEEDOR */
INSERT INTO dbo.ProductoProveedor (ProductoId, ProveedorId)
SELECT P.ProductoId, PR.ProveedorId
FROM dbo.Productos P
CROSS JOIN dbo.Proveedores PR
WHERE P.SKU = 'TM-AIRPODS-001'
  AND PR.NombreEmpresa = 'Apple Ecuador'
  AND NOT EXISTS
  (
      SELECT 1 FROM dbo.ProductoProveedor PP
      WHERE PP.ProductoId = P.ProductoId
        AND PP.ProveedorId = PR.ProveedorId
  );

INSERT INTO dbo.ProductoProveedor (ProductoId, ProveedorId)
SELECT P.ProductoId, PR.ProveedorId
FROM dbo.Productos P
CROSS JOIN dbo.Proveedores PR
WHERE P.SKU = 'TM-GPRO-001'
  AND PR.NombreEmpresa = 'Logitech Ecuador'
  AND NOT EXISTS
  (
      SELECT 1 FROM dbo.ProductoProveedor PP
      WHERE PP.ProductoId = P.ProductoId
        AND PP.ProveedorId = PR.ProveedorId
  );

INSERT INTO dbo.ProductoProveedor (ProductoId, ProveedorId)
SELECT P.ProductoId, PR.ProveedorId
FROM dbo.Productos P
CROSS JOIN dbo.Proveedores PR
WHERE P.SKU = 'TM-IPHONE-001'
  AND PR.NombreEmpresa = 'Apple Ecuador'
  AND NOT EXISTS
  (
      SELECT 1 FROM dbo.ProductoProveedor PP
      WHERE PP.ProductoId = P.ProductoId
        AND PP.ProveedorId = PR.ProveedorId
  );

INSERT INTO dbo.ProductoProveedor (ProductoId, ProveedorId)
SELECT P.ProductoId, PR.ProveedorId
FROM dbo.Productos P
CROSS JOIN dbo.Proveedores PR
WHERE P.SKU = 'TM-MACBOOK-001'
  AND PR.NombreEmpresa = 'Apple Ecuador'
  AND NOT EXISTS
  (
      SELECT 1 FROM dbo.ProductoProveedor PP
      WHERE PP.ProductoId = P.ProductoId
        AND PP.ProveedorId = PR.ProveedorId
  );

INSERT INTO dbo.ProductoProveedor (ProductoId, ProveedorId)
SELECT P.ProductoId, PR.ProveedorId
FROM dbo.Productos P
CROSS JOIN dbo.Proveedores PR
WHERE P.SKU = 'TM-MXMASTER-001'
  AND PR.NombreEmpresa = 'Logitech Ecuador'
  AND NOT EXISTS
  (
      SELECT 1 FROM dbo.ProductoProveedor PP
      WHERE PP.ProductoId = P.ProductoId
        AND PP.ProveedorId = PR.ProveedorId
  );

INSERT INTO dbo.ProductoProveedor (ProductoId, ProveedorId)
SELECT P.ProductoId, PR.ProveedorId
FROM dbo.Productos P
CROSS JOIN dbo.Proveedores PR
WHERE P.SKU = 'TM-ROG-001'
  AND PR.NombreEmpresa = 'ASUS Ecuador'
  AND NOT EXISTS
  (
      SELECT 1 FROM dbo.ProductoProveedor PP
      WHERE PP.ProductoId = P.ProductoId
        AND PP.ProveedorId = PR.ProveedorId
  );

INSERT INTO dbo.ProductoProveedor (ProductoId, ProveedorId)
SELECT P.ProductoId, PR.ProveedorId
FROM dbo.Productos P
CROSS JOIN dbo.Proveedores PR
WHERE P.SKU = 'TM-RTX4090-001'
  AND PR.NombreEmpresa = 'NVIDIA Distribuidor'
  AND NOT EXISTS
  (
      SELECT 1 FROM dbo.ProductoProveedor PP
      WHERE PP.ProductoId = P.ProductoId
        AND PP.ProveedorId = PR.ProveedorId
  );

INSERT INTO dbo.ProductoProveedor (ProductoId, ProveedorId)
SELECT P.ProductoId, PR.ProveedorId
FROM dbo.Productos P
CROSS JOIN dbo.Proveedores PR
WHERE P.SKU = 'TM-S24-001'
  AND PR.NombreEmpresa = 'Samsung Ecuador'
  AND NOT EXISTS
  (
      SELECT 1 FROM dbo.ProductoProveedor PP
      WHERE PP.ProductoId = P.ProductoId
        AND PP.ProveedorId = PR.ProveedorId
  );
GO

/* IMÁGENES PRINCIPALES */
INSERT INTO dbo.ImagenesProducto (ProductoId, UrlImagen, EsPrincipal)
SELECT P.ProductoId,
       V.UrlImagen,
       1
FROM
(
    VALUES
    ('TM-AIRPODS-001',
     'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=800&q=80'),
    ('TM-GPRO-001',
     'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80'),
    ('TM-IPHONE-001',
     'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80'),
    ('TM-MACBOOK-001',
     'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80'),
    ('TM-MXMASTER-001',
     'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80'),
    ('TM-ROG-001',
     'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80'),
    ('TM-RTX4090-001',
     'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80'),
    ('TM-S24-001',
     'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80')
) V(SKU, UrlImagen)
INNER JOIN dbo.Productos P ON P.SKU = V.SKU
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.ImagenesProducto I
    WHERE I.ProductoId = P.ProductoId
      AND I.EsPrincipal = 1
);
GO

/* INVENTARIO INICIAL */
DECLARE @UsuarioAdmin INT =
(
    SELECT TOP 1 U.UsuarioId
    FROM dbo.Usuarios U
    INNER JOIN dbo.Personas P ON P.PersonaId = U.PersonaId
    WHERE P.Email = 'admin@tecnomega.com'
);

DECLARE @TipoEntrada INT =
(
    SELECT TipoMovimientoId
    FROM dbo.TiposMovimientoInventario
    WHERE Nombre = 'Entrada'
);

INSERT INTO dbo.MovimientosInventario
(
    ProductoId,
    UsuarioId,
    TipoMovimientoId,
    Cantidad,
    Motivo,
    Observacion
)
SELECT
    P.ProductoId,
    @UsuarioAdmin,
    @TipoEntrada,
    V.Cantidad,
    'Inventario inicial',
    'Stock inicial de prueba'
FROM
(
    VALUES
    ('TM-AIRPODS-001', 20),
    ('TM-GPRO-001', 25),
    ('TM-IPHONE-001', 15),
    ('TM-MACBOOK-001', 10),
    ('TM-MXMASTER-001', 30),
    ('TM-ROG-001', 8),
    ('TM-RTX4090-001', 5),
    ('TM-S24-001', 15)
) V(SKU, Cantidad)
INNER JOIN dbo.Productos P ON P.SKU = V.SKU
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.MovimientosInventario MI
    WHERE MI.ProductoId = P.ProductoId
      AND MI.Motivo = 'Inventario inicial'
);
GO

/* ============================================================================
   15. VERIFICACIÓN FINAL
   ============================================================================ */

SELECT
    DB_NAME() AS BaseDeDatos,
    COUNT(*) AS CantidadTablas
FROM sys.tables
WHERE is_ms_shipped = 0;
GO

SELECT COUNT(*) AS CantidadVistas
FROM sys.views
WHERE is_ms_shipped = 0;
GO

SELECT COUNT(*) AS CantidadProcedimientos
FROM sys.procedures
WHERE is_ms_shipped = 0;
GO

SELECT COUNT(*) AS CantidadTriggers
FROM sys.triggers
WHERE parent_class_desc = 'OBJECT_OR_COLUMN';
GO

SELECT
    P.SKU,
    P.Nombre,
    P.Stock,
    P.StockMinimo
FROM dbo.Productos P
ORDER BY P.ProductoId;
GO

SELECT
    Clave,
    TipoDato,
    ValorDecimal,
    ValorEntero,
    ValorTexto,
    ValorBooleano,
    Estado
FROM dbo.Parametros
ORDER BY Clave;
GO

SELECT
    ProductoId,
    SKU,
    Producto,
    StockRegistrado,
    StockCalculado,
    Diferencia
FROM dbo.vw_VerificacionStock
ORDER BY ProductoId;
GO

PRINT '==============================================================';
PRINT 'TECNOMEGA - BASE DE DATOS FINAL CREADA/VERIFICADA';
PRINT 'SQL SERVER 2022';
PRINT '==============================================================';
GO
