IF DB_ID('TECNOMEGA') IS NULL
BEGIN
    CREATE DATABASE TECNOMEGA;
END
GO

  /* Incluye:
   - Usuarios y roles
   - Clientes
   - Categorias
   - Marcas
   - Proveedores
   - Productos
   - Imagenes
   - Inventario
   - Carrito
   - Promociones
   - Pedidos
   - Pagos
   - Favoritos
   - Resenas
   - Facturacion
   - Parametros
   - Triggers
   - Funcion
   - Procedimientos almacenados
   - Indices
   - Vistas
   - Datos iniciales
   - Productos de prueba
   - Imagenes de productos*/

-- 1. CREAR BASE DE DATOS

USE TECNOMEGA;
GO

-- 2. ROLES

CREATE TABLE Roles
(
    RolId INT IDENTITY(1,1) PRIMARY KEY,

    Nombre VARCHAR(50) NOT NULL UNIQUE,

    Descripcion VARCHAR(255),

    Estado BIT NOT NULL DEFAULT 1
);

-- 3. USUARIOS

CREATE TABLE Usuarios
(
    UsuarioId INT IDENTITY(1,1) PRIMARY KEY,

    RolId INT NOT NULL,

    Nombres VARCHAR(100) NOT NULL,

    Apellidos VARCHAR(100) NOT NULL,

    Email VARCHAR(150) NOT NULL UNIQUE,

    PasswordHash VARCHAR(255) NOT NULL,

    Telefono VARCHAR(20),

    FechaRegistro DATETIME2 NOT NULL
        DEFAULT SYSDATETIME(),

    Estado BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_Usuarios_Roles
        FOREIGN KEY (RolId)
        REFERENCES Roles(RolId)
);

-- 4. CLIENTES

CREATE TABLE Clientes
(
    ClienteId INT IDENTITY(1,1) PRIMARY KEY,

    Identificacion VARCHAR(20) NOT NULL UNIQUE,

    Nombres VARCHAR(100) NOT NULL,

    Apellidos VARCHAR(100) NOT NULL,

    Telefono VARCHAR(20),

    Email VARCHAR(150),

    Estado BIT NOT NULL DEFAULT 1,

    FechaRegistro DATETIME2 NOT NULL
        DEFAULT SYSDATETIME()
);

-- 5. DIRECCIONES DE CLIENTES

CREATE TABLE DireccionesCliente
(
    DireccionId INT IDENTITY(1,1) PRIMARY KEY,

    ClienteId INT NOT NULL,

    Provincia VARCHAR(100),

    Ciudad VARCHAR(100),

    Direccion VARCHAR(250) NOT NULL,

    Referencia VARCHAR(250),

    CodigoPostal VARCHAR(20),

    EsPrincipal BIT NOT NULL DEFAULT 0,

    Estado BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_DireccionesCliente_Clientes
        FOREIGN KEY (ClienteId)
        REFERENCES Clientes(ClienteId)
);

-- 6. CATEGORIAS

CREATE TABLE Categorias
(
    CategoriaId INT IDENTITY(1,1) PRIMARY KEY,

    Nombre VARCHAR(100) NOT NULL UNIQUE,

    Descripcion VARCHAR(500),

    Estado BIT NOT NULL DEFAULT 1
);

-- 7. MARCAS

CREATE TABLE Marcas
(
    MarcaId INT IDENTITY(1,1) PRIMARY KEY,

    Nombre VARCHAR(100) NOT NULL UNIQUE,

    Estado BIT NOT NULL DEFAULT 1
);

-- 8. PROVEEDORES

CREATE TABLE Proveedores
(
    ProveedorId INT IDENTITY(1,1) PRIMARY KEY,

    NombreEmpresa VARCHAR(150) NOT NULL,

    Contacto VARCHAR(100),

    Telefono VARCHAR(20),

    Correo VARCHAR(150),

    Direccion VARCHAR(250),

    Estado BIT NOT NULL DEFAULT 1
);

-- 9. PRODUCTOS

CREATE TABLE Productos
(
    ProductoId INT IDENTITY(1,1) PRIMARY KEY,

    CategoriaId INT NOT NULL,

    MarcaId INT NOT NULL,

    ProveedorId INT NOT NULL,

    Nombre VARCHAR(200) NOT NULL,

    Descripcion VARCHAR(MAX),

    Precio DECIMAL(18,2) NOT NULL,

    Stock INT NOT NULL DEFAULT 0,

    StockMinimo INT NOT NULL DEFAULT 0,

    SKU VARCHAR(50) NOT NULL UNIQUE,

    Estado BIT NOT NULL DEFAULT 1,

    FechaCreacion DATETIME2 NOT NULL
        DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Productos_Categorias
        FOREIGN KEY (CategoriaId)
        REFERENCES Categorias(CategoriaId),

    CONSTRAINT FK_Productos_Marcas
        FOREIGN KEY (MarcaId)
        REFERENCES Marcas(MarcaId),

    CONSTRAINT FK_Productos_Proveedores
        FOREIGN KEY (ProveedorId)
        REFERENCES Proveedores(ProveedorId),

    CONSTRAINT CK_Productos_Precio
        CHECK (Precio >= 0),

    CONSTRAINT CK_Productos_Stock
        CHECK (Stock >= 0),

    CONSTRAINT CK_Productos_StockMinimo
        CHECK (StockMinimo >= 0)
);

-- 10. IMAGENES DE PRODUCTOS

CREATE TABLE ImagenesProducto
(
    ImagenId INT IDENTITY(1,1) PRIMARY KEY,

    ProductoId INT NOT NULL,

    UrlImagen VARCHAR(500) NOT NULL,

    EsPrincipal BIT NOT NULL DEFAULT 0,

    CONSTRAINT FK_ImagenesProducto_Productos
        FOREIGN KEY (ProductoId)
        REFERENCES Productos(ProductoId)
);

-- 11. TIPOS DE MOVIMIENTO DE INVENTARIO

CREATE TABLE TiposMovimientoInventario
(
    TipoMovimientoId INT IDENTITY(1,1) PRIMARY KEY,

    Nombre VARCHAR(50) NOT NULL UNIQUE,

    Descripcion VARCHAR(255),

    Estado BIT NOT NULL DEFAULT 1
);

-- 12. MOVIMIENTOS DE INVENTARIO

CREATE TABLE MovimientosInventario
(
    MovimientoId INT IDENTITY(1,1) PRIMARY KEY,

    ProductoId INT NOT NULL,

    ProveedorId INT NULL,

    UsuarioId INT NOT NULL,

    TipoMovimientoId INT NOT NULL,

    Cantidad INT NOT NULL,

    Motivo VARCHAR(255),

    Observacion VARCHAR(500),

    Fecha DATETIME2 NOT NULL
        DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Movimientos_Productos
        FOREIGN KEY (ProductoId)
        REFERENCES Productos(ProductoId),

    CONSTRAINT FK_Movimientos_Proveedores
        FOREIGN KEY (ProveedorId)
        REFERENCES Proveedores(ProveedorId),

    CONSTRAINT FK_Movimientos_Usuarios
        FOREIGN KEY (UsuarioId)
        REFERENCES Usuarios(UsuarioId),

    CONSTRAINT FK_Movimientos_Tipos
        FOREIGN KEY (TipoMovimientoId)
        REFERENCES TiposMovimientoInventario(TipoMovimientoId),

    CONSTRAINT CK_Movimientos_Cantidad
        CHECK (Cantidad > 0)
);

-- 13. CARRITO

CREATE TABLE Carrito
(
    CarritoId INT IDENTITY(1,1) PRIMARY KEY,

    UsuarioId INT NOT NULL,

    FechaCreacion DATETIME2 NOT NULL
        DEFAULT SYSDATETIME(),

    Estado VARCHAR(20) NOT NULL DEFAULT 'Activo',

    CONSTRAINT FK_Carrito_Usuarios
        FOREIGN KEY (UsuarioId)
        REFERENCES Usuarios(UsuarioId),

    CONSTRAINT CK_Carrito_Estado
        CHECK
        (
            Estado IN
            (
                'Activo',
                'Convertido',
                'Abandonado'
            )
        )
);

-- 14. DETALLE DEL CARRITO

CREATE TABLE CarritoDetalle
(
    DetalleId INT IDENTITY(1,1) PRIMARY KEY,

    CarritoId INT NOT NULL,

    ProductoId INT NOT NULL,

    Cantidad INT NOT NULL,

    CONSTRAINT FK_CarritoDetalle_Carrito
        FOREIGN KEY (CarritoId)
        REFERENCES Carrito(CarritoId),

    CONSTRAINT FK_CarritoDetalle_Producto
        FOREIGN KEY (ProductoId)
        REFERENCES Productos(ProductoId),

    CONSTRAINT CK_CarritoDetalle_Cantidad
        CHECK (Cantidad > 0),

    CONSTRAINT UQ_Carrito_Producto
        UNIQUE
        (
            CarritoId,
            ProductoId
        )
);

-- 15. METODOS DE PAGO

CREATE TABLE MetodosPago
(
    MetodoPagoId INT IDENTITY(1,1) PRIMARY KEY,

    Nombre VARCHAR(100) NOT NULL UNIQUE,

    Estado BIT NOT NULL DEFAULT 1
);

-- 16. PROMOCIONES

CREATE TABLE Promociones
(
    PromocionId INT IDENTITY(1,1) PRIMARY KEY,

    Nombre VARCHAR(150) NOT NULL,

    CodigoCupon VARCHAR(50) UNIQUE NULL,

    TipoDescuento VARCHAR(20) NOT NULL,

    ValorDescuento DECIMAL(18,2) NOT NULL,

    MontoMinimoCompra DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    FechaInicio DATETIME2 NOT NULL,

    FechaFin DATETIME2 NOT NULL,

    Estado BIT NOT NULL DEFAULT 1,

    CONSTRAINT CK_Promociones_Tipo
        CHECK
        (
            TipoDescuento IN
            (
                'PORCENTAJE',
                'MONTO_FIJO'
            )
        ),

    CONSTRAINT CK_Promociones_Valor
        CHECK (ValorDescuento >= 0),

    CONSTRAINT CK_Promociones_Minimo
        CHECK (MontoMinimoCompra >= 0),

    CONSTRAINT CK_Promociones_Fechas
        CHECK (FechaFin >= FechaInicio)
);

-- 17. PROMOCION - PRODUCTO

CREATE TABLE PromocionProducto
(
    PromocionId INT NOT NULL,

    ProductoId INT NOT NULL,

    PRIMARY KEY
    (
        PromocionId,
        ProductoId
    ),

    CONSTRAINT FK_PromocionProducto_Promocion
        FOREIGN KEY (PromocionId)
        REFERENCES Promociones(PromocionId),

    CONSTRAINT FK_PromocionProducto_Producto
        FOREIGN KEY (ProductoId)
        REFERENCES Productos(ProductoId)
);

-- 18. PROMOCION - CATEGORIA

CREATE TABLE PromocionCategoria
(
    PromocionId INT NOT NULL,

    CategoriaId INT NOT NULL,

    PRIMARY KEY
    (
        PromocionId,
        CategoriaId
    ),

    CONSTRAINT FK_PromocionCategoria_Promocion
        FOREIGN KEY (PromocionId)
        REFERENCES Promociones(PromocionId),

    CONSTRAINT FK_PromocionCategoria_Categoria
        FOREIGN KEY (CategoriaId)
        REFERENCES Categorias(CategoriaId)
);

-- 19. PEDIDOS

CREATE TABLE Pedidos
(
    PedidoId INT IDENTITY(1,1) PRIMARY KEY,

    UsuarioId INT NOT NULL,

    ClienteId INT NOT NULL,

    DireccionId INT NOT NULL,

    PromocionId INT NULL,

    FechaPedido DATETIME2 NOT NULL
        DEFAULT SYSDATETIME(),

    Subtotal DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    Descuento DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    IVA DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    Total DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    Estado VARCHAR(30)
        NOT NULL DEFAULT 'Pendiente',

    CONSTRAINT FK_Pedidos_Usuarios
        FOREIGN KEY (UsuarioId)
        REFERENCES Usuarios(UsuarioId),

    CONSTRAINT FK_Pedidos_Clientes
        FOREIGN KEY (ClienteId)
        REFERENCES Clientes(ClienteId),

    CONSTRAINT FK_Pedidos_Direcciones
        FOREIGN KEY (DireccionId)
        REFERENCES DireccionesCliente(DireccionId),

    CONSTRAINT FK_Pedidos_Promociones
        FOREIGN KEY (PromocionId)
        REFERENCES Promociones(PromocionId),

    CONSTRAINT CK_Pedidos_Estado
        CHECK
        (
            Estado IN
            (
                'Pendiente',
                'Procesando',
                'Enviado',
                'Entregado',
                'Cancelado'
            )
        ),

    CONSTRAINT CK_Pedidos_Valores
        CHECK
        (
            Subtotal >= 0
            AND Descuento >= 0
            AND IVA >= 0
            AND Total >= 0
        )
);

-- 20. DETALLE DE PEDIDOS

CREATE TABLE PedidoDetalle
(
    PedidoDetalleId INT IDENTITY(1,1) PRIMARY KEY,

    PedidoId INT NOT NULL,

    ProductoId INT NOT NULL,

    Cantidad INT NOT NULL,

    PrecioUnitario DECIMAL(18,2) NOT NULL,

    Subtotal DECIMAL(18,2) NOT NULL,

    Descuento DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    Total DECIMAL(18,2) NOT NULL,

    CONSTRAINT FK_PedidoDetalle_Pedido
        FOREIGN KEY (PedidoId)
        REFERENCES Pedidos(PedidoId),

    CONSTRAINT FK_PedidoDetalle_Producto
        FOREIGN KEY (ProductoId)
        REFERENCES Productos(ProductoId),

    CONSTRAINT CK_PedidoDetalle_Cantidad
        CHECK (Cantidad > 0),

    CONSTRAINT CK_PedidoDetalle_Precio
        CHECK (PrecioUnitario >= 0),

    CONSTRAINT CK_PedidoDetalle_Valores
        CHECK
        (
            Subtotal >= 0
            AND Descuento >= 0
            AND Total >= 0
        )
);

-- 21. PAGOS

CREATE TABLE Pagos
(
    PagoId INT IDENTITY(1,1) PRIMARY KEY,

    PedidoId INT NOT NULL,

    MetodoPagoId INT NOT NULL,

    FechaPago DATETIME2 NOT NULL
        DEFAULT SYSDATETIME(),

    Monto DECIMAL(18,2) NOT NULL,

    Estado VARCHAR(30)
        NOT NULL DEFAULT 'Pendiente',

    TransaccionId VARCHAR(100),

    CONSTRAINT FK_Pagos_Pedidos
        FOREIGN KEY (PedidoId)
        REFERENCES Pedidos(PedidoId),

    CONSTRAINT FK_Pagos_Metodos
        FOREIGN KEY (MetodoPagoId)
        REFERENCES MetodosPago(MetodoPagoId),

    CONSTRAINT CK_Pagos_Monto
        CHECK (Monto >= 0),

    CONSTRAINT CK_Pagos_Estado
        CHECK
        (
            Estado IN
            (
                'Pendiente',
                'Pagado',
                'Rechazado',
                'Cancelado'
            )
        )
);

-- 22. FAVORITOS

CREATE TABLE Favoritos
(
    FavoritoId INT IDENTITY(1,1) PRIMARY KEY,

    UsuarioId INT NOT NULL,

    ProductoId INT NOT NULL,

    Fecha DATETIME2 NOT NULL
        DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Favoritos_Usuarios
        FOREIGN KEY (UsuarioId)
        REFERENCES Usuarios(UsuarioId),

    CONSTRAINT FK_Favoritos_Productos
        FOREIGN KEY (ProductoId)
        REFERENCES Productos(ProductoId),

    CONSTRAINT UQ_Favoritos_Usuario_Producto
        UNIQUE
        (
            UsuarioId,
            ProductoId
        )
);

-- 23. RESENAS

CREATE TABLE Resenas
(
    ResenaId INT IDENTITY(1,1) PRIMARY KEY,

    UsuarioId INT NOT NULL,

    ProductoId INT NOT NULL,

    Calificacion INT NOT NULL,

    Comentario VARCHAR(500),

    Fecha DATETIME2 NOT NULL
        DEFAULT SYSDATETIME(),

    Estado BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_Resenas_Usuarios
        FOREIGN KEY (UsuarioId)
        REFERENCES Usuarios(UsuarioId),

    CONSTRAINT FK_Resenas_Productos
        FOREIGN KEY (ProductoId)
        REFERENCES Productos(ProductoId),

    CONSTRAINT CK_Resenas_Calificacion
        CHECK (Calificacion BETWEEN 1 AND 5)
);

-- 24. FACTURAS

CREATE TABLE Facturas
(
    FacturaId INT IDENTITY(1,1) PRIMARY KEY,

    Numero VARCHAR(30) NOT NULL UNIQUE,

    PedidoId INT NULL,

    ClienteId INT NOT NULL,

    UsuarioId INT NOT NULL,

    Fecha DATETIME2 NOT NULL
        DEFAULT SYSDATETIME(),

    Subtotal DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    Descuento DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    Impuesto DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    Total DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    Estado VARCHAR(30)
        NOT NULL DEFAULT 'Emitida',

    CONSTRAINT FK_Facturas_Pedido
        FOREIGN KEY (PedidoId)
        REFERENCES Pedidos(PedidoId),

    CONSTRAINT FK_Facturas_Cliente
        FOREIGN KEY (ClienteId)
        REFERENCES Clientes(ClienteId),

    CONSTRAINT FK_Facturas_Usuario
        FOREIGN KEY (UsuarioId)
        REFERENCES Usuarios(UsuarioId),

    CONSTRAINT CK_Facturas_Valores
        CHECK
        (
            Subtotal >= 0
            AND Descuento >= 0
            AND Impuesto >= 0
            AND Total >= 0
        ),

    CONSTRAINT CK_Facturas_Estado
        CHECK
        (
            Estado IN
            (
                'Emitida',
                'Pagada',
                'Anulada'
            )
        )
);

-- 25. DETALLES DE FACTURA

CREATE TABLE DetallesFactura
(
    DetalleFacturaId INT IDENTITY(1,1) PRIMARY KEY,

    FacturaId INT NOT NULL,

    ProductoId INT NOT NULL,

    Cantidad INT NOT NULL,

    PrecioUnitario DECIMAL(18,2) NOT NULL,

    DescuentoPorcentaje DECIMAL(5,2)
        NOT NULL DEFAULT 0,

    DescuentoValor DECIMAL(18,2)
        NOT NULL DEFAULT 0,

    Subtotal DECIMAL(18,2) NOT NULL,

    Total DECIMAL(18,2) NOT NULL,

    CONSTRAINT FK_DetallesFactura_Factura
        FOREIGN KEY (FacturaId)
        REFERENCES Facturas(FacturaId),

    CONSTRAINT FK_DetallesFactura_Producto
        FOREIGN KEY (ProductoId)
        REFERENCES Productos(ProductoId),

    CONSTRAINT CK_DetallesFactura_Cantidad
        CHECK (Cantidad > 0),

    CONSTRAINT CK_DetallesFactura_Precio
        CHECK (PrecioUnitario >= 0),

    CONSTRAINT CK_DetallesFactura_Descuento
        CHECK
        (
            DescuentoPorcentaje BETWEEN 0 AND 100
            AND DescuentoValor >= 0
        ),

    CONSTRAINT CK_DetallesFactura_Valores
        CHECK
        (
            Subtotal >= 0
            AND Total >= 0
        )
);

-- 26. PARAMETROS DEL SISTEMA

CREATE TABLE Parametros
(
    ParametroId INT IDENTITY(1,1) PRIMARY KEY,

    Clave VARCHAR(50) NOT NULL UNIQUE,

    Valor VARCHAR(255) NOT NULL,

    Descripcion VARCHAR(255),

    FechaActualizacion DATETIME2 NOT NULL
        DEFAULT SYSDATETIME()
);

                     -- DATOS INICIALES -- 

-- ROLES

INSERT INTO Roles
(
    Nombre,
    Descripcion
)
VALUES
(
    'Administrador',
    'Gestiona usuarios, productos, inventario, promociones y facturacion'
),
(
    'Cliente',
    'Consulta productos y realiza compras'
);

-- CATEGORIAS

INSERT INTO Categorias
(
    Nombre,
    Descripcion
)
VALUES
(
    'Audio',
    'Audifonos y dispositivos de audio'
),
(
    'Perifericos',
    'Mouse, teclados y accesorios'
),
(
    'Smartphones',
    'Telefonos inteligentes'
),
(
    'Laptops',
    'Computadoras portatiles'
),
(
    'Gaming',
    'Equipos y productos para videojuegos'
),
(
    'Componentes',
    'Componentes para computadoras'
);

-- MARCAS

INSERT INTO Marcas
(
    Nombre
)
VALUES
(
    'Apple'
),
(
    'Logitech'
),
(
    'ASUS'
),
(
    'NVIDIA'
),
(
    'Samsung'
);

-- PROVEEDORES

INSERT INTO Proveedores
(
    NombreEmpresa,
    Contacto,
    Telefono,
    Correo,
    Direccion
)
VALUES
(
    'Apple Ecuador',
    'Ventas',
    '0999999001',
    'ventas@apple.com',
    'Quito, Ecuador'
),
(
    'Logitech Ecuador',
    'Ventas',
    '0999999002',
    'ventas@logitech.com',
    'Quito, Ecuador'
),
(
    'ASUS Ecuador',
    'Ventas',
    '0999999003',
    'ventas@asus.com',
    'Quito, Ecuador'
),
(
    'NVIDIA Distribuidor',
    'Ventas',
    '0999999004',
    'ventas@nvidia.com',
    'Quito, Ecuador'
),
(
    'Samsung Ecuador',
    'Ventas',
    '0999999005',
    'ventas@samsung.com',
    'Quito, Ecuador'
);

-- TIPOS DE MOVIMIENTO

INSERT INTO TiposMovimientoInventario
(
    Nombre,
    Descripcion
)
VALUES
(
    'Entrada',
    'Ingreso de productos al inventario'
),
(
    'Salida',
    'Salida de productos del inventario'
),
(
    'Ajuste',
    'Ajuste positivo del inventario'
);

-- METODOS DE PAGO

INSERT INTO MetodosPago
(
    Nombre
)
VALUES
(
    'Efectivo'
),
(
    'Transferencia'
),
(
    'Tarjeta'
);

-- PARAMETROS

INSERT INTO Parametros
(
    Clave,
    Valor,
    Descripcion
)
VALUES
(
    'IVA_PORCENTAJE',
    '15.00',
    'Porcentaje de IVA utilizado para calcular impuestos'
),
(
    'COSTO_ENVIO_BASE',
    '5.00',
    'Costo de envio estandar'
);

                      -- PRODUCTOS --

-- AIRPODS

INSERT INTO Productos
(
    CategoriaId,
    MarcaId,
    ProveedorId,
    Nombre,
    Descripcion,
    Precio,
    Stock,
    StockMinimo,
    SKU
)
VALUES
(
    (SELECT CategoriaId
     FROM Categorias
     WHERE Nombre = 'Audio'),

    (SELECT MarcaId
     FROM Marcas
     WHERE Nombre = 'Apple'),

    (SELECT ProveedorId
     FROM Proveedores
     WHERE NombreEmpresa = 'Apple Ecuador'),

    'AirPods',

    'Audifonos inalambricos Apple',

    249.99,

    20,

    5,

    'TM-AIRPODS-001'
);

-- LOGITECH G PRO

INSERT INTO Productos
(
    CategoriaId,
    MarcaId,
    ProveedorId,
    Nombre,
    Descripcion,
    Precio,
    Stock,
    StockMinimo,
    SKU
)
VALUES
(
    (SELECT CategoriaId
     FROM Categorias
     WHERE Nombre = 'Perifericos'),

    (SELECT MarcaId
     FROM Marcas
     WHERE Nombre = 'Logitech'),

    (SELECT ProveedorId
     FROM Proveedores
     WHERE NombreEmpresa = 'Logitech Ecuador'),

    'Logitech G Pro',

    'Mouse gaming Logitech G Pro',

    129.99,

    25,

    5,

    'TM-GPRO-001'
);

-- IPHONE

INSERT INTO Productos
(
    CategoriaId,
    MarcaId,
    ProveedorId,
    Nombre,
    Descripcion,
    Precio,
    Stock,
    StockMinimo,
    SKU
)
VALUES
(
    (SELECT CategoriaId
     FROM Categorias
     WHERE Nombre = 'Smartphones'),

    (SELECT MarcaId
     FROM Marcas
     WHERE Nombre = 'Apple'),

    (SELECT ProveedorId
     FROM Proveedores
     WHERE NombreEmpresa = 'Apple Ecuador'),

    'iPhone',

    'Smartphone Apple iPhone',

    799.99,

    15,

    3,

    'TM-IPHONE-001'
);

-- MACBOOK

INSERT INTO Productos
(
    CategoriaId,
    MarcaId,
    ProveedorId,
    Nombre,
    Descripcion,
    Precio,
    Stock,
    StockMinimo,
    SKU
)
VALUES
(
    (SELECT CategoriaId
     FROM Categorias
     WHERE Nombre = 'Laptops'),

    (SELECT MarcaId
     FROM Marcas
     WHERE Nombre = 'Apple'),

    (SELECT ProveedorId
     FROM Proveedores
     WHERE NombreEmpresa = 'Apple Ecuador'),

    'MacBook',

    'Computadora portatil Apple MacBook',

    999.99,

    10,

    2,

    'TM-MACBOOK-001'
);

-- MX MASTER

INSERT INTO Productos
(
    CategoriaId,
    MarcaId,
    ProveedorId,
    Nombre,
    Descripcion,
    Precio,
    Stock,
    StockMinimo,
    SKU
)
VALUES
(
    (SELECT CategoriaId
     FROM Categorias
     WHERE Nombre = 'Perifericos'),

    (SELECT MarcaId
     FROM Marcas
     WHERE Nombre = 'Logitech'),

    (SELECT ProveedorId
     FROM Proveedores
     WHERE NombreEmpresa = 'Logitech Ecuador'),

    'Logitech MX Master',

    'Mouse inalambrico Logitech MX Master',

    99.99,

    30,

    5,

    'TM-MXMASTER-001'
);

-- ASUS ROG

INSERT INTO Productos
(
    CategoriaId,
    MarcaId,
    ProveedorId,
    Nombre,
    Descripcion,
    Precio,
    Stock,
    StockMinimo,
    SKU
)
VALUES
(
    (SELECT CategoriaId
     FROM Categorias
     WHERE Nombre = 'Gaming'),

    (SELECT MarcaId
     FROM Marcas
     WHERE Nombre = 'ASUS'),

    (SELECT ProveedorId
     FROM Proveedores
     WHERE NombreEmpresa = 'ASUS Ecuador'),

    'ASUS ROG',

    'Laptop gaming ASUS ROG',

    1499.99,

    8,

    2,

    'TM-ROG-001'
);

-- RTX 4090

INSERT INTO Productos
(
    CategoriaId,
    MarcaId,
    ProveedorId,
    Nombre,
    Descripcion,
    Precio,
    Stock,
    StockMinimo,
    SKU
)
VALUES
(
    (SELECT CategoriaId
     FROM Categorias
     WHERE Nombre = 'Componentes'),

    (SELECT MarcaId
     FROM Marcas
     WHERE Nombre = 'NVIDIA'),

    (SELECT ProveedorId
     FROM Proveedores
     WHERE NombreEmpresa = 'NVIDIA Distribuidor'),

    'RTX 4090',

    'Tarjeta grafica NVIDIA GeForce RTX 4090',

    1899.99,

    5,

    1,

    'TM-RTX4090-001'
);

-- SAMSUNG S24

INSERT INTO Productos
(
    CategoriaId,
    MarcaId,
    ProveedorId,
    Nombre,
    Descripcion,
    Precio,
    Stock,
    StockMinimo,
    SKU
)
VALUES
(
    (SELECT CategoriaId
     FROM Categorias
     WHERE Nombre = 'Smartphones'),

    (SELECT MarcaId
     FROM Marcas
     WHERE Nombre = 'Samsung'),

    (SELECT ProveedorId
     FROM Proveedores
     WHERE NombreEmpresa = 'Samsung Ecuador'),

    'Samsung Galaxy S24',

    'Smartphone Samsung Galaxy S24',

    799.99,

    15,

    3,

    'TM-S24-001'
);

                      -- IMAGENES --

-- Limpiar imagenes por seguridad

DELETE FROM ImagenesProducto;

DECLARE @ProductoId INT;

-- 1. AIRPODS

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%AirPods%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?auto=format&fit=crop&w=800&q=80',
        1
    );

END;

-- 2. LOGITECH G PRO

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%G Pro%'
   OR Nombre LIKE '%GPro%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80',
        1
    );

END;

-- 3. IPHONE - IMAGEN PRINCIPAL

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%iPhone%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80',
        1
    );

END;

-- 4. IPHONE - IMAGEN SECUNDARIA

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%iPhone%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80',
        0
    );

END;

-- 5. MACBOOK - IMAGEN PRINCIPAL

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%MacBook%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
        1
    );

END;

-- 6. MACBOOK - IMAGEN SECUNDARIA

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%MacBook%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80',
        0
    );

END;

-- 7. MX MASTER

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%MX Master%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
        1
    );

END;

-- 8. ASUS ROG - IMAGEN PRINCIPAL

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%ROG%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80',
        1
    );

END;

-- 9. ASUS ROG - IMAGEN SECUNDARIA

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%ROG%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1593640495253-23614febab66?auto=format&fit=crop&w=800&q=80',
        0
    );

END;

-- 10. RTX 4090

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%RTX 4090%'
   OR Nombre LIKE '%4090%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=800&q=80',
        1
    );

END;

-- 11. SAMSUNG S24 - IMAGEN PRINCIPAL

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%S24%'
   OR Nombre LIKE '%Galaxy S24%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80',
        1
    );

END;

-- 12. SAMSUNG S24 - IMAGEN SECUNDARIA

SET @ProductoId = NULL;

SELECT TOP 1
    @ProductoId = ProductoId
FROM Productos
WHERE Nombre LIKE '%S24%'
   OR Nombre LIKE '%Galaxy S24%';

IF @ProductoId IS NOT NULL
BEGIN

    INSERT INTO ImagenesProducto
    (
        ProductoId,
        UrlImagen,
        EsPrincipal
    )
    VALUES
    (
        @ProductoId,
        'https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&w=800&q=80',
        0
    );

END;
GO

                         -- TRIGGER --
   
/*Actualiza automaticamente el stock cuando se registra
un movimiento de inventario.*/

CREATE OR ALTER TRIGGER TR_MovimientosInventario_ActualizarStock
ON MovimientosInventario
AFTER INSERT
AS
BEGIN

    SET NOCOUNT ON;

       -- VALIDAR STOCK EN SALIDAS --

    IF EXISTS
    (
        SELECT 1

        FROM Productos P

        INNER JOIN
        (
            SELECT
                I.ProductoId,

                SUM
                (
                    CASE

                        WHEN T.Nombre = 'Entrada'
                            THEN I.Cantidad

                        WHEN T.Nombre = 'Salida'
                            THEN -I.Cantidad

                        WHEN T.Nombre = 'Ajuste'
                            THEN I.Cantidad

                        ELSE 0

                    END
                ) AS CambioStock

            FROM inserted I

            INNER JOIN TiposMovimientoInventario T
                ON I.TipoMovimientoId =
                   T.TipoMovimientoId

            GROUP BY I.ProductoId

        ) M

        ON P.ProductoId = M.ProductoId

        WHERE P.Stock + M.CambioStock < 0
    )
    BEGIN

        RAISERROR
        (
            'No existe suficiente stock para realizar el movimiento.',
            16,
            1
        );

        ROLLBACK TRANSACTION;

        RETURN;

    END;

       -- ACTUALIZAR STOCK --

    UPDATE P

    SET P.Stock =
        P.Stock + M.CambioStock

    FROM Productos P

    INNER JOIN
    (
        SELECT
            I.ProductoId,

            SUM
            (
                CASE

                    WHEN T.Nombre = 'Entrada'
                        THEN I.Cantidad

                    WHEN T.Nombre = 'Salida'
                        THEN -I.Cantidad

                    WHEN T.Nombre = 'Ajuste'
                        THEN I.Cantidad

                    ELSE 0

                END
            ) AS CambioStock

        FROM inserted I

        INNER JOIN TiposMovimientoInventario T
            ON I.TipoMovimientoId =
               T.TipoMovimientoId

        GROUP BY I.ProductoId

    ) M

    ON P.ProductoId =
       M.ProductoId;

END;
GO

                         -- FUNCION --

CREATE OR ALTER FUNCTION fn_CalcularTotalLineaFactura
(
    @Cantidad INT,

    @PrecioUnitario DECIMAL(18,2),

    @DescuentoPorcentaje DECIMAL(5,2)
)
RETURNS DECIMAL(18,2)
AS
BEGIN

    DECLARE @Subtotal DECIMAL(18,2);

    DECLARE @Descuento DECIMAL(18,2);

    DECLARE @Total DECIMAL(18,2);


    SET @Subtotal =
        @Cantidad * @PrecioUnitario;


    SET @Descuento =
        @Subtotal *
        (@DescuentoPorcentaje / 100);


    SET @Total =
        @Subtotal - @Descuento;


    RETURN @Total;

END;
GO

                 -- PROCEDIMIENTO ENTRADA INVENTARIO --

CREATE OR ALTER PROCEDURE sp_RegistrarEntradaInventario

    @ProductoId INT,

    @ProveedorId INT = NULL,

    @UsuarioId INT,

    @Cantidad INT,

    @Motivo VARCHAR(255) = NULL,

    @Observacion VARCHAR(500) = NULL

AS
BEGIN

    SET NOCOUNT ON;


    IF @Cantidad <= 0
    BEGIN

        RAISERROR
        (
            'La cantidad debe ser mayor que cero.',
            16,
            1
        );

        RETURN;

    END;


    IF NOT EXISTS
    (
        SELECT 1
        FROM Productos
        WHERE ProductoId = @ProductoId
          AND Estado = 1
    )
    BEGIN

        RAISERROR
        (
            'El producto no existe o esta inactivo.',
            16,
            1
        );

        RETURN;

    END;


    IF NOT EXISTS
    (
        SELECT 1
        FROM Usuarios
        WHERE UsuarioId = @UsuarioId
          AND Estado = 1
    )
    BEGIN

        RAISERROR
        (
            'El usuario no existe o esta inactivo.',
            16,
            1
        );

        RETURN;

    END;


    INSERT INTO MovimientosInventario
    (
        ProductoId,
        ProveedorId,
        UsuarioId,
        TipoMovimientoId,
        Cantidad,
        Motivo,
        Observacion
    )

    SELECT

        @ProductoId,

        @ProveedorId,

        @UsuarioId,

        TipoMovimientoId,

        @Cantidad,

        @Motivo,

        @Observacion

    FROM TiposMovimientoInventario

    WHERE Nombre = 'Entrada';


    SELECT

        ProductoId,

        Nombre,

        Stock

    FROM Productos

    WHERE ProductoId = @ProductoId;

END;
GO

   -- PROCEDIMIENTO SALIDA INVENTARIO --

CREATE OR ALTER PROCEDURE sp_RegistrarSalidaInventario

    @ProductoId INT,

    @UsuarioId INT,

    @Cantidad INT,

    @Motivo VARCHAR(255) = NULL,

    @Observacion VARCHAR(500) = NULL

AS
BEGIN

    SET NOCOUNT ON;


    IF @Cantidad <= 0
    BEGIN

        RAISERROR
        (
            'La cantidad debe ser mayor que cero.',
            16,
            1
        );

        RETURN;

    END;


    IF NOT EXISTS
    (
        SELECT 1
        FROM Productos
        WHERE ProductoId = @ProductoId
          AND Estado = 1
    )
    BEGIN

        RAISERROR
        (
            'El producto no existe o esta inactivo.',
            16,
            1
        );

        RETURN;

    END;


    IF NOT EXISTS
    (
        SELECT 1
        FROM Usuarios
        WHERE UsuarioId = @UsuarioId
          AND Estado = 1
    )
    BEGIN

        RAISERROR
        (
            'El usuario no existe o esta inactivo.',
            16,
            1
        );

        RETURN;

    END;


    IF NOT EXISTS
    (
        SELECT 1
        FROM Productos
        WHERE ProductoId = @ProductoId
          AND Stock >= @Cantidad
    )
    BEGIN

        RAISERROR
        (
            'No existe suficiente stock.',
            16,
            1
        );

        RETURN;

    END;


    INSERT INTO MovimientosInventario
    (
        ProductoId,
        ProveedorId,
        UsuarioId,
        TipoMovimientoId,
        Cantidad,
        Motivo,
        Observacion
    )

    SELECT

        @ProductoId,

        NULL,

        @UsuarioId,

        TipoMovimientoId,

        @Cantidad,

        @Motivo,

        @Observacion

    FROM TiposMovimientoInventario

    WHERE Nombre = 'Salida';


    SELECT

        ProductoId,

        Nombre,

        Stock

    FROM Productos

    WHERE ProductoId = @ProductoId;

END;
GO

   -- PROCEDIMIENTO AJUSTE INVENTARIO --

CREATE OR ALTER PROCEDURE sp_RegistrarAjusteInventario

    @ProductoId INT,

    @UsuarioId INT,

    @Cantidad INT,

    @Motivo VARCHAR(255) = NULL,

    @Observacion VARCHAR(500) = NULL

AS
BEGIN

    SET NOCOUNT ON;


    IF @Cantidad <= 0
    BEGIN

        RAISERROR
        (
            'La cantidad debe ser mayor que cero.',
            16,
            1
        );

        RETURN;

    END;


    INSERT INTO MovimientosInventario
    (
        ProductoId,
        ProveedorId,
        UsuarioId,
        TipoMovimientoId,
        Cantidad,
        Motivo,
        Observacion
    )

    SELECT

        @ProductoId,

        NULL,

        @UsuarioId,

        TipoMovimientoId,

        @Cantidad,

        @Motivo,

        @Observacion

    FROM TiposMovimientoInventario

    WHERE Nombre = 'Ajuste';


    SELECT

        ProductoId,

        Nombre,

        Stock

    FROM Productos

    WHERE ProductoId = @ProductoId;

END;
GO

   -- CONSULTAR STOCK --

CREATE OR ALTER PROCEDURE sp_ConsultarStockProducto

    @ProductoId INT

AS
BEGIN

    SET NOCOUNT ON;


    SELECT

        P.ProductoId,

        P.Nombre AS Producto,

        P.SKU,

        P.Stock,

        P.StockMinimo,

        CASE

            WHEN P.Stock = 0
                THEN 'SIN STOCK'

            WHEN P.Stock <= P.StockMinimo
                THEN 'STOCK BAJO'

            ELSE 'STOCK NORMAL'

        END AS EstadoStock

    FROM Productos P

    WHERE P.ProductoId = @ProductoId;

END;
GO

   -- PRODUCTOS STOCK BAJO --

CREATE OR ALTER PROCEDURE sp_ProductosStockBajo

AS
BEGIN

    SET NOCOUNT ON;


    SELECT

        P.ProductoId,

        P.Nombre AS Producto,

        P.SKU,

        P.Stock,

        P.StockMinimo,

        C.Nombre AS Categoria,

        M.Nombre AS Marca

    FROM Productos P

    INNER JOIN Categorias C
        ON P.CategoriaId =
           C.CategoriaId

    INNER JOIN Marcas M
        ON P.MarcaId =
           M.MarcaId

    WHERE P.Stock <= P.StockMinimo

      AND P.Estado = 1

    ORDER BY P.Stock ASC;

END;
GO

   -- CONSULTAR MOVIMIENTOS --

CREATE OR ALTER PROCEDURE sp_ConsultarMovimientosInventario

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

        U.Nombres + ' ' + U.Apellidos
            AS Usuario,

        PR.NombreEmpresa
            AS Proveedor,

        MI.Motivo,

        MI.Observacion,

        MI.Fecha

    FROM MovimientosInventario MI

    INNER JOIN Productos P
        ON MI.ProductoId =
           P.ProductoId

    INNER JOIN TiposMovimientoInventario T
        ON MI.TipoMovimientoId =
           T.TipoMovimientoId

    INNER JOIN Usuarios U
        ON MI.UsuarioId =
           U.UsuarioId

    LEFT JOIN Proveedores PR
        ON MI.ProveedorId =
           PR.ProveedorId

    WHERE
        @ProductoId IS NULL
        OR MI.ProductoId = @ProductoId

    ORDER BY MI.Fecha DESC;

END;
GO

   -- CONSULTAR FACTURAS POR FECHA --

CREATE OR ALTER PROCEDURE sp_ConsultarFacturasPorFecha

    @FechaInicio DATE,

    @FechaFin DATE

AS
BEGIN

    SET NOCOUNT ON;


    SELECT

        F.FacturaId,

        F.Numero,

        C.Identificacion,

        C.Nombres + ' ' + C.Apellidos
            AS Cliente,

        F.Fecha,

        F.Subtotal,

        F.Descuento,

        F.Impuesto,

        F.Total,

        F.Estado

    FROM Facturas F

    INNER JOIN Clientes C
        ON F.ClienteId =
           C.ClienteId

    WHERE F.Fecha >= @FechaInicio

      AND F.Fecha <
          DATEADD(DAY, 1, @FechaFin)

    ORDER BY F.Fecha DESC;

END;
GO

   -- CONSULTAR FACTURA --

CREATE OR ALTER PROCEDURE sp_ConsultarFactura

    @FacturaId INT

AS
BEGIN

    SET NOCOUNT ON;


    SELECT

        F.FacturaId,

        F.Numero,

        F.Fecha,

        C.Identificacion,

        C.Nombres + ' ' + C.Apellidos
            AS Cliente,

        C.Email,

        C.Telefono,

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

    FROM Facturas F

    INNER JOIN Clientes C
        ON F.ClienteId =
           C.ClienteId

    INNER JOIN DetallesFactura DF
        ON F.FacturaId =
           DF.FacturaId

    INNER JOIN Productos P
        ON DF.ProductoId =
           P.ProductoId

    WHERE F.FacturaId =
          @FacturaId;

END;
GO

                         -- INDICES --

CREATE INDEX IX_Productos_Categoria
ON Productos(CategoriaId);

CREATE INDEX IX_Productos_Marca
ON Productos(MarcaId);

CREATE INDEX IX_Productos_Proveedor
ON Productos(ProveedorId);

CREATE INDEX IX_Productos_Stock
ON Productos(Stock);

CREATE INDEX IX_Movimientos_Producto
ON MovimientosInventario(ProductoId);

CREATE INDEX IX_Movimientos_Fecha
ON MovimientosInventario(Fecha);

CREATE INDEX IX_Pedidos_Cliente
ON Pedidos(ClienteId);

CREATE INDEX IX_Pedidos_Usuario
ON Pedidos(UsuarioId);

CREATE INDEX IX_Pedidos_Fecha
ON Pedidos(FechaPedido);

CREATE INDEX IX_PedidoDetalle_Pedido
ON PedidoDetalle(PedidoId);

CREATE INDEX IX_PedidoDetalle_Producto
ON PedidoDetalle(ProductoId);

CREATE INDEX IX_Facturas_Cliente
ON Facturas(ClienteId);

CREATE INDEX IX_Facturas_Fecha
ON Facturas(Fecha);

CREATE INDEX IX_DetallesFactura_Factura
ON DetallesFactura(FacturaId);

CREATE INDEX IX_DetallesFactura_Producto
ON DetallesFactura(ProductoId);

CREATE INDEX IX_Promociones_Fechas
ON Promociones(FechaInicio, FechaFin);
GO

                          -- VISTAS --
-- VISTA INVENTARIO --

CREATE VIEW vw_InventarioActual
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

        WHEN P.Stock = 0
            THEN 'SIN STOCK'

        WHEN P.Stock <= P.StockMinimo
            THEN 'STOCK BAJO'

        ELSE 'STOCK NORMAL'

    END AS EstadoStock,

    P.Estado

FROM Productos P

INNER JOIN Categorias C
    ON P.CategoriaId =
       C.CategoriaId

INNER JOIN Marcas M
    ON P.MarcaId =
       M.MarcaId;
GO

-- VISTA VENTAS --

CREATE VIEW vw_Ventas
AS

SELECT

    F.FacturaId,

    F.Numero,

    F.Fecha,

    C.Identificacion,

    C.Nombres + ' ' + C.Apellidos
        AS Cliente,

    F.Subtotal,

    F.Descuento,

    F.Impuesto,

    F.Total,

    F.Estado

FROM Facturas F

INNER JOIN Clientes C
    ON F.ClienteId =
       C.ClienteId;
GO

-- VISTA PRODUCTOS CON IMAGEN --

CREATE VIEW vw_ProductosCatalogo
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

FROM Productos P

INNER JOIN Categorias C
    ON P.CategoriaId =
       C.CategoriaId

INNER JOIN Marcas M
    ON P.MarcaId =
       M.MarcaId

LEFT JOIN ImagenesProducto I
    ON P.ProductoId =
       I.ProductoId

    AND I.EsPrincipal = 1;
GO

                     -- COMPROBACION FINAL --

SELECT
    'ROLES' AS Tabla,
    COUNT(*) AS Registros
FROM Roles

UNION ALL

SELECT
    'CATEGORIAS',
    COUNT(*)
FROM Categorias

UNION ALL

SELECT
    'MARCAS',
    COUNT(*)
FROM Marcas

UNION ALL

SELECT
    'PROVEEDORES',
    COUNT(*)
FROM Proveedores

UNION ALL

SELECT
    'PRODUCTOS',
    COUNT(*)
FROM Productos

UNION ALL

SELECT
    'IMAGENES PRODUCTO',
    COUNT(*)
FROM ImagenesProducto

UNION ALL

SELECT
    'TIPOS MOVIMIENTO',
    COUNT(*)
FROM TiposMovimientoInventario

UNION ALL

SELECT
    'METODOS PAGO',
    COUNT(*)
FROM MetodosPago

UNION ALL

SELECT
    'PARAMETROS',
    COUNT(*)
FROM Parametros;

-- MOSTRAR PRODUCTOS CARGADOS --

SELECT

    P.ProductoId,

    P.SKU,

    P.Nombre,

    C.Nombre AS Categoria,

    M.Nombre AS Marca,

    P.Precio,

    P.Stock,

    P.StockMinimo,

    I.UrlImagen,

    I.EsPrincipal

FROM Productos P

INNER JOIN Categorias C
    ON P.CategoriaId =
       C.CategoriaId

INNER JOIN Marcas M
    ON P.MarcaId =
       M.MarcaId

LEFT JOIN ImagenesProducto I
    ON P.ProductoId =
       I.ProductoId

ORDER BY P.ProductoId;